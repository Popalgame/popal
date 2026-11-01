#!/usr/bin/env python3
"""Local, inspectable 2D face analysis for stylized front references.

This first backend uses colour/region heuristics, not a trained semantic model.
Optional region hints are recorded as user input; missing features stay unknown.
Coordinates are original-image pixels, x right, y down. No hidden 3D is inferred.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageColor
from scipy import ndimage as ndi

from scan import detect_axis, detect_face
from hair_scan import scan_hair
from occlusion import annotate_contour
from eye_scan import KINDS, COLORS, ocular_masks, add_metrology, sensitivity_summary
from facial_layout import ear_candidates, add_layout, add_details, save_layout, compare_layout
from head_profile import analyse_profile, compare_profiles, save_profile
from face_shape import analyse_shape, compare_shapes, save_shape, save_comparison

SCHEMA = "polpal.face-scan/1"


def box(value, width, height):
    if len(value) != 4 or any(not math.isfinite(float(v)) for v in value):
        raise ValueError("ROI must contain four finite coordinates")
    x0, y0, x1, y1 = map(lambda v: int(round(v)), value)
    if not (0 <= x0 < x1 <= width and 0 <= y0 < y1 <= height):
        raise ValueError(f"ROI outside image or empty: {value}")
    return [x0, y0, x1, y1]


def region_mask(shape, bounds):
    mask = np.zeros(shape, dtype=bool)
    x0, y0, x1, y1 = bounds
    mask[y0:y1, x0:x1] = True
    return mask


def component(mask, target=None):
    labels, count = ndi.label(mask)
    if not count:
        return np.zeros_like(mask)
    sizes = np.bincount(labels.ravel()); sizes[0] = 0
    chosen = int(np.argmax(sizes))
    if target is not None:
        x, y = map(int, target)
        if 0 <= y < mask.shape[0] and 0 <= x < mask.shape[1] and labels[y, x]:
            chosen = int(labels[y, x])
    return labels == chosen


def thin_runs(mask, maximum):
    """Reject hair-sized vertical runs before connected-component selection."""
    result = np.zeros_like(mask)
    for x in np.flatnonzero(mask.any(axis=0)):
        rows = np.flatnonzero(mask[:, x])
        for run in np.split(rows, np.flatnonzero(np.diff(rows)>1)+1):
            if 1 < len(run) <= maximum:
                result[run, x] = True
    return result


def colour(rgb, mask):
    values = rgb[mask]
    if not len(values):
        return None
    median = np.median(values, axis=0).round().astype(int).tolist()
    return {"median_srgb": median, "hex": "#%02x%02x%02x" % tuple(median),
            "p10_srgb": np.percentile(values, 10, axis=0).round().astype(int).tolist(),
            "p90_srgb": np.percentile(values, 90, axis=0).round().astype(int).tolist(),
            "meaning": "observed lit pixels; not recovered material albedo"}


def mask_feature(rgb, mask, bounds, kind, min_area=4):
    ys, xs = np.nonzero(mask)
    if len(xs) < min_area:
        return {"status": "unknown", "reason": "No sufficiently large matching region",
                "region_px": bounds, "kind": kind}
    x0, y0, x1, y1 = bounds
    clipped = bool(np.any((xs <= x0) | (xs >= x1-1) | (ys <= y0) | (ys >= y1-1)))
    # Preserve gaps instead of drawing a measured contour through occlusion.
    runs = []
    current = []
    for x in range(int(xs.min()), int(xs.max())+1):
        rows = np.flatnonzero(mask[:, x])
        if len(rows):
            current.append([x, int(rows.min()), int(rows.max())])
        elif current:
            runs.append(current); current = []
    if current:
        runs.append(current)
    return {"status": "partial" if clipped else "candidate", "kind": kind,
            "method": "regional colour component", "region_px": bounds,
            "bbox_px": [int(xs.min()), int(ys.min()), int(xs.max()+1), int(ys.max()+1)],
            "centroid_px": [float(xs.mean()), float(ys.mean())], "area_px": len(xs),
            "touches_region_boundary": clipped, "colour": colour(rgb, mask),
            "column_runs": runs}


def brow_measurements(feature, side):
    if feature["status"] == "unknown":
        return
    runs = feature["column_runs"]
    longest = max(runs, key=len)
    centers = [[x, (a+b)/2] for x, a, b in longest]
    # Order medial -> lateral, regardless of image-side label.
    if side == "left":
        centers.reverse()
    x = np.array([p[0] for p in centers]); y = np.array([p[1] for p in centers])
    slope = float(np.polyfit(x, y, 1)[0]) if len(x) > 1 else 0.0
    thickness = [(b-a+1)/math.sqrt(1+slope*slope) for _, a, b in longest]
    rise = centers[0][1]-centers[-1][1]
    feature.update({"centerline_px": centers, "inner_px": centers[0], "outer_px": centers[-1],
                    "outer_rise_px": rise,
                    "outer_angle_degrees": math.degrees(math.atan2(rise, abs(x[-1]-x[0]))),
                    "median_thickness_px": float(np.median(thickness)),
                    "max_thickness_px": float(max(thickness)),
                    "thickness_note": "column thickness projected normal to fitted slope; visible fragment only"})


def scan_face(path, roi=None, hints=None, calibration=None):
    path = Path(path)
    rgba = np.asarray(Image.open(path).convert("RGBA"))
    rgb = rgba[..., :3]; valid = rgba[..., 3] > 127
    h, w = valid.shape
    hints = hints or {}
    if set(hints) - {"roi", "eye_centers_px", "regions", "notes", "hair_roi", "exclude_fit_regions", "calibration", "feature_masks", "head_roi", "side_profile", "face_outline"}:
        raise ValueError("Unknown hint fields")
    source_hash = hashlib.sha256(path.read_bytes()).hexdigest()
    evidence = []
    centers = hints.get("eye_centers_px")
    if centers is not None:
        if len(centers) != 2 or any(len(p) != 2 for p in centers):
            raise ValueError("eye_centers_px requires two [x,y] points")
        if any(not math.isfinite(float(v)) for p in centers for v in p):
            raise ValueError("Nonfinite eye hints")
        if any(not (0 <= x < w and 0 <= y < h) for x, y in centers):
            raise ValueError("Eye hints outside image")
        centers = sorted(centers)
        evidence.append("Eye search centres supplied as hints")
    else:
        yy = np.flatnonzero(valid.any(axis=1))
        if not len(yy):
            raise ValueError("Transparent image: no visible face")
        top, height = int(yy[0]), int(yy[-1]-yy[0]+1)
        # Limit old detector to opaque pixels; transparent RGB is not evidence.
        detected = detect_face(np.where(valid[..., None], rgb, 0).astype(np.uint8),
                               detect_axis(valid, top, height), top, height)
        if not detected:
            raise ValueError("No reliable eye pair. Supply eye_centers_px hints for this reference")
        centers = [[x, detected["eye_line_y"]] for x in detected["eye_centers_px"]]
        evidence.append("Eye search centres proposed by existing teal-iris detector")
    separation = float(centers[1][0]-centers[0][0])
    if separation < 8 or abs(centers[1][1]-centers[0][1]) > separation*.35:
        raise ValueError("Eye pair unsuitable for a frontal scan")
    cx = sum(p[0] for p in centers)/2; ey = sum(p[1] for p in centers)/2

    def clipped(values):
        x0,y0,x1,y1 = values
        return box([max(0,x0),max(0,y0),min(w,x1),min(h,y1)], w,h)

    roi = box(roi or hints.get("roi") or clipped([cx-1.25*separation,ey-separation,
                                               cx+1.25*separation,ey+1.05*separation]), w,h)
    if any(not (roi[0] <= x < roi[2] and roi[1] <= y < roi[3]) for x,y in centers):
        raise ValueError("Eye centres must lie inside face ROI")
    hsv = np.asarray(Image.fromarray(rgb).convert("HSV")).astype(float)
    hue,sat,val = np.moveaxis(hsv,-1,0)
    teal = (hue >= 90)&(hue <= 160)&(sat >= 65)&(val >= 35)&valid
    rose = ((hue > 225)|(hue < 5))&(sat > 45)&(val > 55)&valid
    skin = (hue >= 5)&(hue <= 32)&(sat >= 18)&(sat <= 190)&(val >= 85)&valid
    regions = hints.get("regions", {})
    allowed = {"skin","mouth","nose","freckles","ear_left","ear_right"} | {k+'_'+s for k in KINDS for s in ('left','right')}
    if set(regions)-allowed:
        raise ValueError("Unknown region names: "+str(sorted(set(regions)-allowed)))

    def region(name, default):
        b = box(regions[name],w,h) if name in regions else clipped(default)
        if b[0]<roi[0] or b[1]<roi[1] or b[2]>roi[2] or b[3]>roi[3]:
            raise ValueError(f"{name} region must lie inside face ROI")
        return b

    features = {}; masks = {}
    for side, (x,y) in zip(("left","right"), centers):
        for kind, bounds, selection in (
            ("iris", [x-.38*separation,y-.38*separation,x+.38*separation,y+.38*separation],teal),
            ("brow", [x-.34*separation,y-.68*separation,x+.34*separation,y-.35*separation],rose)):
            name = f"{kind}_{side}"; b = region(name,bounds)
            raw = selection & region_mask((h,w),b)
            if kind == "brow":
                raw = thin_runs(raw,max(3,int(separation*.095)))
            mask = component(raw)
            f = mask_feature(rgb,mask,b,kind,min_area=max(4,int(separation**2*.0003)))
            f["region_source"] = "hint" if name in regions else "eye-relative heuristic"
            if kind == "brow":
                if f["status"] != "unknown":
                    bw = f["bbox_px"][2]-f["bbox_px"][0]
                    bh = f["bbox_px"][3]-f["bbox_px"][1]
                    if bw < .12*separation or bw/max(1,bh) < 1.5:
                        f = {"status":"unknown","kind":kind,"region_px":b,
                             "reason":"Matching colour is not an elongated brow fragment"}
                        mask[:] = False
                brow_measurements(f,side)
                if f["status"] != "unknown":
                    adjacent = ndi.binary_dilation(mask) & selection & ~mask
                    if adjacent.any():
                        f["status"] = "partial"
                        f["occlusion_note"] = "Thin fragment meets a larger same-colour region; ends not established"
            features[name] = f; masks[name] = mask

    for side, (x,y) in zip(('left','right'), centers):
        b=region('eye_'+side,[x-.48*separation,y-.43*separation,x+.48*separation,y+.40*separation])
        diagnostics={}
        detected=ocular_masks(rgb,valid,masks['iris_'+side],b,separation,diagnostics=diagnostics)
        variants=[ocular_masks(rgb,valid,masks['iris_'+side],b,separation,v) for v in (-1,1)]
        for kind,mask in detected.items():
            name=kind+'_'+side
            bounds=region(name,b)
            mask &= region_mask((h,w),bounds)
            f=mask_feature(rgb,mask,bounds,kind,min_area=max(4,int(separation**2*.0003)))
            f['region_source']='hint' if name in regions else 'iris-relative heuristic'
            if kind in ('eye','sclera') and diagnostics.get('rejected_sclera_components'):
                f['rejected_sclera_components']=diagnostics['rejected_sclera_components']
                if f['status']!='unknown':f['status']='partial'
                f['occlusion_note']='Rejected light components reaching search boundary: possible skin leakage or crop'
            f['threshold_sensitivity']=sensitivity_summary([mask]+[v[kind]&region_mask((h,w),bounds) for v in variants])
            f['method']={'eye':'aperture candidate: iris search envelope (one-pixel closing + hole fill) and adjacent sclera',
                         'sclera':'cool light components touching iris; internal highlights excluded',
                         'pupil':'central dark component inside iris; highlights excluded',
                         'lash':'dark upper rim touching aperture; lash/eyeliner cannot be separated'}[kind]
            if kind=='lash' and f['status']!='unknown':
                f['status']='partial'
                f['occlusion_note']='Upper lash/liner silhouette only; individual hairs and lower lashes not established'
                brow_measurements(f,side)
            if kind=='pupil' and f['status']!='unknown' and (ndi.binary_fill_holes(mask)&~mask).any():
                f['status']='partial'
                f['occlusion_note']='Highlight holes excluded; measured dark region is not a completed pupil'
            if kind=='pupil' and f['status']!='unknown':
                highlight=(val>170)&(sat<75)&valid
                if (ndi.binary_dilation(mask,iterations=2)&highlight).any():
                    f['status']='partial'
                    f['occlusion_note']='Dark pupil touches a highlight; unobserved pupil boundary is not completed'
            features[name]=f;masks[name]=mask

    annotations=hints.get('feature_masks',{})
    if not isinstance(annotations,dict) or set(annotations)-(allowed-{'skin','freckles'}):
        raise ValueError('feature_masks supports ocular, nose, mouth and ear names only')
    def annotated_feature(name,item):
        if (not isinstance(item,dict) or set(item)!={'path','source_sha256','status'} or
            item['source_sha256']!=source_hash or item['status'] not in ('candidate','partial')):
            raise ValueError('Annotated mask needs matching source_sha256, path and candidate/partial status')
        source=Path(item['path']);image=Image.open(source)
        if image.size!=(w,h):raise ValueError('Annotated mask dimensions differ from reference')
        values=np.asarray(image.convert('L'))
        if not np.isin(values,[0,255]).all():raise ValueError('Annotated mask must be binary 0/255')
        mask=values>127
        bounds=features[name]['region_px'] if name.startswith('ear_') else roi
        if (mask&~valid).any() or (mask&~region_mask((h,w),bounds)).any():
            raise ValueError('Annotated mask includes transparent pixels or lies outside face ROI')
        f=mask_feature(rgb,mask,bounds,name.split('_')[0])
        if f['status']!='unknown':f['status']=item['status']
        f.update(method='user-supplied visible mask; semantic boundary requires review',
                 annotation={'path':str(source.resolve()),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
                             'source_sha256':source_hash},region_source='user mask')
        if name.startswith(('brow_','lash_')):brow_measurements(f,name.rsplit('_',1)[1])
        return f,mask
    for name,item in annotations.items():
        if name not in ('nose','mouth','ear_left','ear_right'):
            features[name],masks[name]=annotated_feature(name,item)

    hair_bounds=box(hints.get("hair_roi") or clipped([cx-2.8*separation,ey-3.6*separation,
                                                    cx+2.8*separation,ey+1.8*separation]),w,h)
    excluded=np.zeros_like(valid)
    for mask in masks.values():excluded |= ndi.binary_dilation(mask,iterations=2)
    hair,hair_mask=scan_hair(hsv,valid,hair_bounds,separation,ey,excluded)
    hair["colour"]=colour(rgb,hair_mask)
    hair["region_source"]="hint" if "hair_roi" in hints else "eye-relative head region"
    features["hair"]=hair;masks["hair"]=hair_mask
    excluded_regions=[box(value,w,h) for value in hints.get("exclude_fit_regions",[])]

    b = region("skin",roi)
    skin_mask = component(ndi.binary_closing(skin & region_mask((h,w),b),iterations=2)
                          & region_mask((h,w),b)&valid&~hair_mask,(cx,ey+.3*separation))
    features["skin"] = {"status":"candidate" if skin_mask.any() else "unknown",
                        "colour":colour(rgb,skin_mask),"region_px":b,
                        "method":"warm-skin connected component; can include neck and miss shadow"}
    masks["skin"] = skin_mask
    # Record the visible skin boundary, NOT a completed face/skull silhouette.
    rows = []
    for y in range(max(b[1],int(ey)),b[3]):
        xs = np.flatnonzero(skin_mask[y])
        if len(xs) > separation*.25:
            rows.append({"y":y,"left":int(xs.min()),"right":int(xs.max()),
                         "width_px":int(xs.max()-xs.min()+1)})
    features["visible_skin_contour"] = {"status":"partial" if rows else "unknown",
        "rows":rows,"method":"row extrema of skin mask below eyes",
        "limitations":["Hair and shadows may replace the anatomical boundary",
                       "Connected neck is not automatically separable from chin"]}
    guard,near_hair=annotate_contour(rows,hair_mask,b,separation,excluded_regions)
    for name in (k+'_'+s for k in KINDS for s in ('left','right')):
        f=features[name]
        if f["status"]!="unknown" and (masks[name]&near_hair).any():
            f["status"]="partial"
            f["occlusion_note"]="Observed fragment near hair candidate; hidden extent unknown"
        if f['status']!='unknown' and (ndi.binary_dilation(masks[name]) & ~valid).any():
            f['status']='partial'
            f['occlusion_note']='Mask touches transparent pixels; extent unavailable'

    luminance = rgb.astype(float) @ np.array([.2126,.7152,.0722])
    residual = ndi.gaussian_filter(luminance,max(.8,separation*.018))-luminance
    # Lip and nose observations remain candidates, never semantic ground truth.
    for name, bounds in (("mouth",[cx-.28*separation,ey+.45*separation,cx+.28*separation,ey+.68*separation]),
                         ("nose",[cx-.13*separation,ey+.12*separation,cx+.13*separation,ey+.40*separation])):
        b = region(name,bounds)
        selection = skin_mask & ~near_hair & region_mask((h,w),b) & (residual > (4 if name=="mouth" else 2.5))
        mask = component(selection)
        f = mask_feature(rgb,mask,b,name)
        if f["status"] != "unknown":
            f["method"] = "local dark contrast; semantic identity unverified"
        features[name] = f; masks[name] = mask

    ear_regions={name:box(regions[name],w,h) for name in ('ear_left','ear_right') if name in regions}
    ears,ear_masks=ear_candidates(skin,valid,roi,centers,ear_regions)
    features.update(ears);masks.update(ear_masks)
    for name,item in annotations.items():
        if name in ('nose','mouth','ear_left','ear_right'):
            features[name],masks[name]=annotated_feature(name,item)

    b = region("freckles",[cx-.95*separation,ey+.10*separation,cx+.95*separation,ey+.60*separation])
    small = skin_mask & ~near_hair & region_mask((h,w),b) & (residual > 9)
    # Exclude central nose/mouth and both eye regions from spot counting.
    small[:,max(0,int(cx-.16*separation)):min(w,int(cx+.16*separation))] = False
    for side in ("left","right"):
        small[ndi.binary_dilation(masks["iris_"+side],iterations=3)] = False
    labels,count = ndi.label(small); spots=[]; spotmask=np.zeros_like(small)
    for index, sl in enumerate(ndi.find_objects(labels),1):
        if sl is None: continue
        local = labels[sl]==index
        area = int(local.sum()); sy,sx=sl
        if not 1 <= area <= max(6,separation**2*.0008): continue
        if max(sx.stop-sx.start,sy.stop-sy.start) > max(4,separation*.035): continue
        yy,xx=np.nonzero(local)
        spots.append({"center_px":[float(xx.mean()+sx.start),float(yy.mean()+sy.start)],"area_px":area})
        spotmask[sl] |= local
    masks["freckles"] = spotmask
    features["freckles"] = {"status":"candidate" if spots else "unknown","spots":spots,
                            "method":"small dark skin components; can include texture/compression",
                            "colour":colour(rgb,spotmask),"region_px":b}
    warnings = ["Heuristic backend tuned for warm skin, teal irises and rose brows; other palettes require a different backend.",
                "No depth, hidden anatomy, full material albedo or generation-ready topology is recovered.",
                "Partial contours describe visible fragments; never complete them as measured data."]
    for name,f in features.items():
        if f["status"] in ("unknown","partial"):
            warnings.append(f"{name}: {f['status']}")
    result = {"schema":SCHEMA,"backend":"regional-hsv-face-shape/7","source":str(path.resolve()),
              "source_sha256":source_hash,"image":{"width":w,"height":h},"roi_px":roi,
              "coordinates":"original pixels; x right, y down; left/right are image sides",
              "registration":{"axis_x_px":cx,"eye_line_y_px":ey,"eye_spacing_px":separation},
              "input_hints":hints,"localization_evidence":evidence,"features":features,"warnings":warnings,
              "occlusion_guard":guard,
              "capabilities":{"full_character":False,"depth":False,"trained_semantics":False,"automatic_3d":False,
                              "hair_candidates":True,"occlusion_guard":True}}
    if calibration is not None and hints.get('calibration') is not None:
        raise ValueError('Supply calibration once, not both as argument and face hint')
    add_metrology(result,masks,calibration if calibration is not None else hints.get('calibration'))
    head_roi=box(hints['head_roi'],w,h) if hints.get('head_roi') is not None else None
    add_layout(result,masks,head_roi)
    detail_mask=add_details(result,masks,rgb,valid)
    masks['facial_details']=detail_mask
    features['facial_details']={'status':result['facial_details']['status'],'kind':'contrast candidates'}
    result['head_profile']=analyse_profile(hints.get('side_profile'))
    analyse_shape(result,masks,rgb,valid,hints.get('face_outline'))
    result['capabilities']['ocular_metrology_2d']=True
    result['capabilities'].update(facial_spacing=True,visible_ear_candidates=True,facial_contrast_candidates=True,side_profile_input=True)
    result['capabilities']['face_chin_contours']=True
    return result,masks,rgb


def save_scan(result,masks,rgb,out):
    out=Path(out);out.mkdir(parents=True,exist_ok=False)
    (out/"masks").mkdir()
    overlay=Image.fromarray(rgb).convert("RGB")
    draw=ImageDraw.Draw(overlay)
    palette={"skin":"#ffe486","iris_left":"#15e5e5","iris_right":"#15e5e5",
             "brow_left":"#58ff68","brow_right":"#58ff68","mouth":"#ffae64","nose":"#ffae64","freckles":"#e576ff",
               "hair":"#69a7ff","ear_left":"#42e8df","ear_right":"#42e8df","facial_details":"#ff75dc"}
    palette.update({k+'_'+s:color for k,color in COLORS.items() for s in ('left','right')})
    for name,mask in masks.items():
        Image.fromarray(mask.astype(np.uint8)*255).save(out/"masks"/(name+".png"))
        boundary=mask & ~ndi.binary_erosion(mask)
        pixels=np.asarray(overlay).copy()
        pixels[boundary]=ImageColor.getrgb(palette[name])
        overlay=Image.fromarray(pixels);draw=ImageDraw.Draw(overlay)
        f=result["features"][name]
        if "centerline_px" in f:
            draw.line([tuple(p) for p in f["centerline_px"]],fill="white",width=1)
    x0,y0,x1,y1=result["roi_px"]
    overlay.save(out/"overlay.png")
    crop=overlay.crop((x0,y0,x1,y1))
    crop.resize((crop.width*2,crop.height*2),Image.Resampling.NEAREST).save(out/"face-overlay.png")
    # A dedicated eligibility view keeps hair boundaries and fitting exclusions readable.
    pixels=rgb.copy();hair=masks["hair"]
    pixels[hair]=(pixels[hair]*.6+np.array([85,135,255])*.4).astype(np.uint8)
    eligibility=Image.fromarray(pixels);draw=ImageDraw.Draw(eligibility)
    for row in result["features"]["visible_skin_contour"]["rows"]:
        for side in ("left","right"):
            x,y=row[side],row["y"]
            color="#69ff92" if row["fit_checks"][side]["eligible"] else "#ff4e54"
            draw.ellipse((x-1,y-1,x+1,y+1),fill=color)
    eligibility.crop(result["roi_px"]).resize((crop.width*2,crop.height*2),Image.Resampling.NEAREST).save(out/"occlusion-overlay.png")
    eligibility.crop(result["features"]["hair"]["region_px"]).save(out/"hair-overlay.png")
    Image.fromarray(np.dstack([rgb,hair.astype(np.uint8)*255])).save(out/"hair-evidence.png")
    if 'ocular_metrology' in result:
        save_ocular(result,masks,rgb,out)
    if 'facial_layout' in result:
        save_layout(result,masks,rgb,out,masks['facial_details'])
        save_profile(result['head_profile'],out)
    if 'face_shape' in result:save_shape(result,rgb,out)
    (out/"face-scan.json").write_text(json.dumps(result,indent=2,allow_nan=False)+"\n")
    lines=["# Face Scan","",f"Backend: `{result['backend']}`","",
           "All coordinates are 2D image observations. Candidates need visual review.","",
           "| Feature | Status |","| --- | --- |"]
    lines += [f"| {name} | {f['status']} |" for name,f in result["features"].items()]
    lines += ["","## Limitations",""]+["- "+s for s in result["warnings"]]
    lines += ["","## Hair / occlusion", "", "Blue tint: hair candidates. Red: rejected contour samples. Green: no detected exclusion.",
              "Eligibility is not proof of an unobstructed anatomical contour.",
              "",json.dumps(result["occlusion_guard"],indent=2)]
    (out/"report.md").write_text("\n".join(lines)+"\n")


def save_ocular(result,masks,rgb,out):
    """Separate evidence panels avoid hiding sclera/pupil boundaries under iris."""
    roi=result['roi_px'];x0,y0,x1,y1=roi
    width,height=(x1-x0)*2,(y1-y0)*2
    sheet=Image.new('RGB',(width*3,(height+34)*2),(28,34,39))
    rows=[]
    for i,kind in enumerate(KINDS):
        pixels=rgb.copy()
        for side in ('left','right'):
            name=kind+'_'+side;mask=masks[name];f=result['features'][name]
            boundary=mask & ~ndi.binary_erosion(mask)
            pixels[boundary]=ImageColor.getrgb(COLORS[kind])
            g=f.get('geometry_2d',{});mm=g.get('mm',{})
            rows.append([name,f['status'],g.get('width_px'),g.get('height_px'),
                         *(g.get('centroid_px') or [None,None]),mm.get('width'),mm.get('height'),
                         *(mm.get('centroid_xz') or [None,None]),mm.get('area_mm2'),
                         f.get('median_thickness_px'),mm.get('median_thickness')])
        panel=Image.fromarray(pixels).crop(roi).resize((width,height),Image.Resampling.NEAREST)
        x,y=(i%3)*width,(i//3)*(height+34)
        sheet.paste(panel,(x,y+34));draw=ImageDraw.Draw(sheet)
        statuses=' / '.join(result['features'][kind+'_'+s]['status'] for s in ('left','right'))
        draw.text((x+10,y+10),kind.upper()+' | '+statuses,fill=COLORS[kind])
    sheet.save(out/'ocular-overlay.png')
    with (out/'ocular-measurements.csv').open('w',newline='') as stream:
        writer=csv.writer(stream)
        writer.writerow(['feature','status','width_px','height_px','center_x_px','center_y_px',
                         'width_mm','height_mm','center_x_mm','center_z_mm','area_mm2',
                         'median_thickness_px','median_thickness_mm'])
        writer.writerows(rows)
    cal=result['ocular_metrology']['calibration']
    lines=['# Eye / lash / brow measurements','',
           'Visible 2D candidates. Pixel centres are integers; contours follow half-pixel cell edges.',
           'Pupil highlights remain holes. Sclera fragments stay disconnected. Lash means upper lash/liner silhouette.',
           '', 'Calibration: '+json.dumps(cal,ensure_ascii=False),'',
           '| Feature | Status | Width px | Height px | Width mm | Height mm |',
           '| --- | --- | ---: | ---: | ---: | ---: |']
    for row in rows:
        def fmt(v):return '—' if v is None else f'{v:.3f}'
        lines.append(f'| {row[0]} | {row[1]} | {fmt(row[2])} | {fmt(row[3])} | {fmt(row[6])} | {fmt(row[7])} |')
    lines += ['', 'Decimal places are numeric output precision, not proof of millimetre accuracy.',
              'Unknown/partial features need review in ocular-overlay.png; no hidden dimensions are completed.']
    (out/'ocular-report.md').write_text('\n'.join(lines)+'\n')


def compare_scans(reference,candidate):
    """Compare measured fragments in eye-normalized space, with no global score."""
    if reference.get("schema")!=SCHEMA or candidate.get("schema")!=SCHEMA:
        raise ValueError("Unsupported face scan schema")
    def norm(scan,p):
        r=scan["registration"];s=r["eye_spacing_px"]
        if not math.isfinite(s) or s<=0:raise ValueError("Invalid registration")
        return [(p[0]-r["axis_x_px"])/s,(p[1]-r["eye_line_y_px"])/s]
    deltas={};skipped={}
    for name,a in reference["features"].items():
        b=candidate["features"].get(name,{"status":"unknown"})
        if a["status"] in ("unknown","partial") or b["status"] in ("unknown","partial"):
            skipped[name]="unknown or partial feature; no complete-feature comparison"
            continue
        if "centroid_px" in a and "centroid_px" in b:
            pa,pb=norm(reference,a["centroid_px"]),norm(candidate,b["centroid_px"])
            d={"centroid_delta_eye_units":[pb[0]-pa[0],pb[1]-pa[1]],"status":"candidate comparison"}
            ga,gb=a.get('geometry_2d'),b.get('geometry_2d')
            if ga and gb:
                for key in ('width','height'):
                    d[key+'_delta_eye_units']=gb[key+'_px']/candidate['registration']['eye_spacing_px']-ga[key+'_px']/reference['registration']['eye_spacing_px']
                if 'mm' in ga and 'mm' in gb:
                    d['calibrated_mm']={key+'_delta':gb['mm'][key]-ga['mm'][key] for key in ('width','height')}
                    d['calibrated_mm']['centroid_xz_delta']=[gb['mm']['centroid_xz'][i]-ga['mm']['centroid_xz'][i] for i in (0,1)]
                    d['calibrated_mm']['note']='Requires comparable scale basis, origin and projection in both scans'
            if "median_thickness_px" in a and "median_thickness_px" in b:
                d["thickness_delta_eye_units"]=b["median_thickness_px"]/candidate["registration"]["eye_spacing_px"]-a["median_thickness_px"]/reference["registration"]["eye_spacing_px"]
                d["outer_angle_delta_degrees"]=b["outer_angle_degrees"]-a["outer_angle_degrees"]
            deltas[name]=d
    fragments={};facial_fragments={}
    for name,a in reference['features'].items():
        b=candidate['features'].get(name,{})
        ga,gb=a.get('geometry_2d'),b.get('geometry_2d')
        if not ga or not gb:continue
        pa,pb=norm(reference,ga['centroid_px']),norm(candidate,gb['centroid_px'])
        item={'reference_status':a['status'],'candidate_status':b['status'],
              'scope':'visible-mask comparison; partial extents are not full-feature dimensions',
              'centroid_delta_eye_units':[pb[i]-pa[i] for i in (0,1)]}
        for key in ('width','height'):
            item[key+'_delta_eye_units']=gb[key+'_px']/candidate['registration']['eye_spacing_px']-ga[key+'_px']/reference['registration']['eye_spacing_px']
        if 'mm' in ga and 'mm' in gb:
            item['calibrated_mm']={k+'_delta':gb['mm'][k]-ga['mm'][k] for k in ('width','height')}
            item['calibrated_mm']['centroid_xz_delta']=[gb['mm']['centroid_xz'][i]-ga['mm']['centroid_xz'][i] for i in (0,1)]
            item['calibrated_mm']['note']='Conditional on comparable physical scale, origin and projection'
        if name.split('_')[0] in KINDS:fragments[name]=item
        else:facial_fragments[name]=item
    return {"schema":"polpal.face-comparison/1","features":deltas,"skipped":skipped,
             'ocular_visible_fragments':fragments,
             'facial_visible_fragments':facial_fragments,
             'facial_spacing':compare_layout(reference,candidate),
             'head_profile':compare_profiles(reference.get('head_profile',{}),candidate.get('head_profile',{})),
             'face_shape':compare_shapes(reference.get('face_shape'),candidate.get('face_shape')),
            "scope":"2D candidate measurements only; not a semantic or 3D fidelity score"}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    sub=parser.add_subparsers(dest="command",required=True)
    p=sub.add_parser("scan");p.add_argument("image",type=Path);p.add_argument("--out",type=Path,required=True)
    p.add_argument("--roi",nargs=4,type=int);p.add_argument("--hints",type=Path)
    p.add_argument('--mm-per-px',type=float);p.add_argument('--origin-px',nargs=2,type=float)
    p.add_argument('--side-profile',type=Path,help='JSON specification of independent upright side reference')
    p=sub.add_parser("compare");p.add_argument("reference",type=Path);p.add_argument("candidate",type=Path)
    p.add_argument("--out",type=Path,required=True)
    args=parser.parse_args()
    if args.command=="scan":
        hints=json.loads(args.hints.read_text()) if args.hints else {}
        if args.side_profile:
            if 'side_profile' in hints:parser.error('Supply side_profile once')
            hints['side_profile']=json.loads(args.side_profile.read_text())
        if args.origin_px and args.mm_per_px is None:parser.error('--origin-px requires --mm-per-px')
        cal={'mm_per_px':args.mm_per_px,'origin_px':args.origin_px or [0,0]} if args.mm_per_px is not None else None
        result,masks,rgb=scan_face(args.image,args.roi,hints,cal)
        save_scan(result,masks,rgb,args.out)
        print(args.out/"face-scan.json")
    else:
        a,b=json.loads(args.reference.read_text()),json.loads(args.candidate.read_text())
        report=compare_scans(a,b)
        with args.out.open("x") as stream:json.dump(report,stream,indent=2,allow_nan=False)
        save_comparison(a.get('face_shape'),b.get('face_shape'),args.out.with_suffix('.face-shape.png'))


if __name__=="__main__":
    main()
