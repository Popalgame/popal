#!/usr/bin/env python3
"""Local full-reference workflow: foreground, face/hair, clothing and equipment.

The Aiko profile supplies explicit region/palette priors. Results are observed
2D fragments and unknowns, never a complete anatomical reconstruction.
"""
import argparse
import csv
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image,ImageDraw,ImageOps
from scipy import ndimage as ndi

from body_scan import foreground,measure_body
from face_scan import scan_face,save_scan,compare_scans
from part_scan import analyse_parts
from scan import load_font,mask_to_canvas
from face_shape import save_comparison

SCHEMA='polpal.character-scan/1'
GROUP_COLORS={'body':(255,194,115),'clothing':(80,218,182),'equipment':(255,151,77)}


def analyse(path,height_mm=1800,hints=None,profile='aiko-front'):
    path=Path(path);hints=hints or {}
    if not isinstance(hints,dict) or set(hints)-{'face','parts','registration','notes'}:
        raise ValueError('Full scan hints support face, parts, registration and notes')
    if not isinstance(hints.get('face',{}),dict):raise ValueError('face hints must be an object')
    rgb,mask,mode=foreground(path)
    body=measure_body(mask,mode,height_mm,hints.get('registration'))
    face=None;face_masks={};face_error=None
    cal={'mm_per_px':body['scale']['mm_per_px'],
         'origin_px':[body['registration']['axis_x_px'],body['registration']['ground_y_px']],
         'basis':body['scale']['basis']}
    try:face,face_masks,_=scan_face(path,hints=hints.get('face'),calibration=cal)
    except ValueError as error:
        if hints.get('face'):raise
        face_error=str(error)
    head=np.zeros_like(mask)
    for m in face_masks.values():head|=m
    parts,part_masks,ambiguous=analyse_parts(rgb,mask,body,head,hints.get('parts'),profile)
    for feature in parts.values():
        if 'bbox_px' in feature:
            feature['width_mm']=feature['width_px']*body['scale']['mm_per_px']
            feature['height_mm']=feature['height_px']*body['scale']['mm_per_px']
            feature['scale_note']='projected extent under supplied physical scale; not anatomical dimensions'
    assigned=np.zeros_like(mask)
    for m in part_masks.values():assigned|=m
    assigned|=head&mask
    unresolved=mask&~assigned
    # Surface contrast is deliberately kept separate from geometry/depth.
    lum=rgb.astype(float)@np.array([.2126,.7152,.0722])
    residual=np.abs(lum-ndi.gaussian_filter(lum,max(1,body['height_px']*.002)))
    details=np.zeros_like(mask)
    for name,m in part_masks.items():
        if parts[name]['group']=='clothing':details|=ndi.binary_erosion(m,iterations=2)&(residual>8)
    groups={}
    for group in ('body','clothing','equipment'):
        members=[name for name,f in parts.items() if f['group']==group]
        groups[group]={'status':'partial' if any(parts[n]['area_px'] for n in members) else 'unknown','parts':members}
    report={'schema':SCHEMA,'version':'1.3.0','source':str(path.resolve()),
        'source_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
        'image':{'width':rgb.shape[1],'height':rgb.shape[0]},'profile':profile,'input_hints':hints,
        'coordinates':'original image pixels, x right/y down; bbox ends exclusive; row run ends inclusive',
        'body':body,'registration':body['registration'],'parts':parts,'modules':groups,
        'face':{'status':'partial','report':'face/face-scan.json'} if face else {'status':'unknown','reason':face_error},
        'surface_details':{'status':'candidate' if details.any() else 'unknown','area_px':int(details.sum()),
                           'meaning':'local contrast on clothing; may be quilting, seams, texture or lighting; not depth'},
        'coverage':{'foreground_px':int(mask.sum()),'assigned_px':int((assigned&mask).sum()),
                    'unresolved_px':int(unresolved.sum()),'ambiguous_px':int(ambiguous.sum()),
                    'meaning':'pixel accounting, not semantic accuracy'},
        'limitations':body['warnings']+[
            'Aiko region/palette priors assume a front-facing reference with similar pose and proportions.',
            'Partial masks do not establish full garment/prop shape. Overlapping classifications are unresolved.',
            'Straps, fasteners, finger anatomy and individual strands are not automatically resolved.',
            'Hidden surfaces, depth, topology, rigging and animation require modelling decisions.'],
        'capabilities':{'visible_2d_measurements':True,'automatic_3d':False,'trained_semantics':False,'game_ready':False}}
    report['modules']['face_hair']={'status':report['face']['status']}
    report['modules']['silhouette']={'status':body['status']}
    report['modules']['surface_details']={'status':report['surface_details']['status']}
    return report,{'foreground':mask,'ambiguous':ambiguous,'unresolved':unresolved,'surface_details':details,
                   **{'part_'+name:m for name,m in part_masks.items()}},rgb,(face,face_masks)


def save_bundle(report,masks,rgb,face_bundle,out):
    out=Path(out);out.mkdir(parents=True,exist_ok=False)
    (out/'masks').mkdir();(out/'evidence').mkdir()
    face,face_masks=face_bundle
    if face:save_scan(face,face_masks,rgb,out/'face')
    for name,m in masks.items():
        Image.fromarray(m.astype(np.uint8)*255).save(out/'masks'/(name+'.png'))
        if name.startswith('part_') and m.any():
            Image.fromarray(np.dstack([rgb,m.astype(np.uint8)*255])).save(out/'evidence'/(name[5:]+'.png'))
    fg=masks['foreground']
    base=np.where(fg[...,None],rgb,np.array([38,43,49],dtype=np.uint8)).astype(np.uint8)
    overlay=base.copy()
    for name,feature in report['parts'].items():
        m=masks['part_'+name];color=np.array(GROUP_COLORS[feature['group']])
        overlay[m]=(rgb[m]*.48+color*.52).astype(np.uint8)
    overlay[masks['ambiguous']]=[239,89,170]
    Image.fromarray(overlay).save(out/'parts-overlay.png')
    body_overlay=Image.fromarray(base);draw=ImageDraw.Draw(body_overlay)
    for section in report['body']['cross_sections']:
        y=section['y']
        for a,b in section['runs_px']:draw.line((a,y,b,y),fill='#ffdf72',width=2)
    body_overlay.save(out/'body-overlay.png')
    unknown=base.copy();unknown[masks['unresolved']]=(unknown[masks['unresolved']]*.35+np.array([200,200,220])*.65).astype(np.uint8)
    Image.fromarray(unknown).save(out/'unresolved-overlay.png')
    with (out/'width-profile.csv').open('w',newline='') as stream:
        writer=csv.writer(stream);writer.writerow(['y','outer_width_px','occupied_width_px','runs_px'])
        for row in report['body']['width_profile']:
            writer.writerow([row['y'],row['outer_width_px'],row['occupied_width_px'],json.dumps(row['runs_px'])])
    lines=['# Character Scan 1.0 — local 2D study','',f"Profile: `{report['profile']}`",
        '',f"Source SHA-256: `{report['source_sha256']}`",'',
        '## Modules','', '| Module | Status |','| --- | --- |']
    lines += [f"| {name} | {m['status']} |" for name,m in report['modules'].items()]
    lines += ['', '## Visible part fragments','', '| Part | Status | Pixels | Origin |', '| --- | --- | ---: | --- |']
    lines += [f"| {name} | {f['status']} | {f['area_px']} | {f['origin']} |" for name,f in report['parts'].items()]
    lines += ['', '## Interpretation','',
        'Green: clothing. Orange: equipment. Warm yellow: exposed-skin candidates. Pink: conflicting labels.',
        'Unresolved pixels remain unassigned. The masks are modelling evidence, not finished assets.',
        '', '## Limitations','']+['- '+s for s in report['limitations']]
    (out/'report.md').write_text('\n'.join(lines)+'\n')
    # Modelling handoff explicitly separates observed targets and missing dimensions.
    brief={'schema':'polpal.modelling-evidence/1','source_sha256':report['source_sha256'],
           'registration':report['registration'],'parts':{name:{'status':f['status'],
           'observed_bbox_px':f.get('bbox_px'),'observed_lit_colour':f['colour'],
           'mask':f'masks/part_{name}.png','interpretation_required':['depth','hidden surfaces','topology','material albedo']}
           for name,f in report['parts'].items()},'game_integration':'requires separate user decision'}
    (out/'modelling-evidence.json').write_text(json.dumps(brief,indent=2)+'\n')
    overview=Image.new('RGB',(1600,1120),(28,34,39));d=ImageDraw.Draw(overview)
    title=load_font(27);small=load_font(20)
    panels=[('REFERENCJA',Image.fromarray(base)),('SYLWETKA / PRZEKROJE',body_overlay),('STRÓJ / WYPOSAŻENIE',Image.fromarray(overlay))]
    for i,(label,image) in enumerate(panels):
        x=20+i*390;d.text((x,20),label,font=small,fill='white')
        image=ImageOps.contain(image,(365,960));overview.paste(image,(x,65))
    x=1190;d.text((x,20),'CHARACTER SCAN 1.0',font=title,fill='white')
    y=80
    for name,f in report['parts'].items():
        d.text((x,y),name,font=small,fill=GROUP_COLORS[f['group']]);y+=25
        d.text((x,y),f"{f['status']} / {f['area_px']} px",font=small,fill='#c5c9cd');y+=38
    d.text((20,1040),'Różowy = konflikt etykiet. Kolory oznaczają kandydatów, nie pewność rozpoznania.',font=small,fill='#e2d6df')
    d.text((20,1075),'Pomiar widocznego przodu. Głębia i ukryte powierzchnie wymagają interpretacji modelarskiej.',font=small,fill='#b8c1c6')
    overview.save(out/'overview.jpg',quality=94)
    report['artifacts']={str(p.relative_to(out)):hashlib.sha256(p.read_bytes()).hexdigest()
                         for p in sorted(out.rglob('*')) if p.is_file()}
    (out/'character-scan.json').write_text(json.dumps(report,indent=2,allow_nan=False)+'\n')


def compare_bundles(reference,candidate):
    from character_geometry import read_bundle
    a=read_bundle(reference);b=read_bundle(candidate)
    masks=[np.asarray(Image.open(Path(path).parent/'masks/foreground.png'))>127 for path in (reference,candidate)]
    # Common normalized canvas, including off-centre equipment and cropping warnings.
    height=768;width=max(round(r['body']['width_px']/r['body']['height_px']*height) for r in (a,b))+768
    canvases=[mask_to_canvas(m,height,width,height+16,r['registration']['axis_x_px']) for m,r in zip(masks,(a,b))]
    union=(canvases[0]|canvases[1]).sum()
    deltas={}
    for name,fa in a['parts'].items():
        fb=b['parts'].get(name)
        if not fb or 'bbox_px' not in fa or 'bbox_px' not in fb:continue
        deltas[name]={'status':'partial-fragment comparison','width_delta_height_units':
            fb['width_px']/b['body']['height_px']-fa['width_px']/a['body']['height_px'],
            'height_delta_height_units':fb['height_px']/b['body']['height_px']-fa['height_px']/a['body']['height_px']}
    face_comparison=None
    if all(r['face']['status']!='unknown' for r in (a,b)):
        faces=[json.loads((Path(p).parent/r['face']['report']).read_text()) for p,r in ((reference,a),(candidate,b))]
        face_comparison=compare_scans(*faces)
    return {'schema':'polpal.character-comparison/1','silhouette_iou':float((canvases[0]&canvases[1]).sum()/union),
        'face':face_comparison,
        'parts':deltas,'reference_sha256':a['source_sha256'],'candidate_sha256':b['source_sha256'],
        'limitations':['Requires comparable front view and pose. IoU is not a likeness or 3D quality score.',
                        'Part extents describe palette fragments; occlusion, profile and lighting can change them.'],
        'clipped':{'reference':a['body']['clipped'],'candidate':b['body']['clipped']}}


def main():
    p=argparse.ArgumentParser(description=__doc__);sub=p.add_subparsers(dest='command',required=True)
    s=sub.add_parser('scan');s.add_argument('image',type=Path);s.add_argument('--out',type=Path,required=True)
    s.add_argument('--height-mm',type=float,default=1800);s.add_argument('--hints',type=Path)
    s.add_argument('--side-profile',type=Path)
    s.add_argument('--profile',choices=['aiko-front','silhouette-only'],default='aiko-front')
    s=sub.add_parser('compare');s.add_argument('reference',type=Path);s.add_argument('candidate',type=Path);s.add_argument('--out',type=Path,required=True)
    args=p.parse_args()
    if args.command=='scan':
        if args.out.exists():raise FileExistsError(args.out)
        hints=json.loads(args.hints.read_text()) if args.hints else {}
        if args.side_profile:
            face_hints=hints.setdefault('face',{})
            if 'side_profile' in face_hints:p.error('Supply side_profile once')
            face_hints['side_profile']=json.loads(args.side_profile.read_text())
        save_bundle(*analyse(args.image,args.height_mm,hints,args.profile),args.out)
        print(args.out/'character-scan.json')
    else:
        result=compare_bundles(args.reference,args.candidate)
        with args.out.open('x') as f:json.dump(result,f,indent=2,allow_nan=False)
        if result['face']:
            faces=[json.loads((path.parent/'face/face-scan.json').read_text()) for path in (args.reference,args.candidate)]
            save_comparison(faces[0].get('face_shape'),faces[1].get('face_shape'),args.out.with_suffix('.face-shape.png'))


if __name__=='__main__':main()
