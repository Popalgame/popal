"""Dependency-free scan validation and bounded 2D-to-mesh fitting helpers."""
import math
import hashlib
from pathlib import Path

SCHEMA = "polpal.face-scan/1"


def validate_report(data):
    if not isinstance(data,dict) or data.get("schema") != SCHEMA:
        raise ValueError("Unsupported Face Scan schema")
    def finite(value):
        if isinstance(value,dict):
            for v in value.values(): finite(v)
        elif isinstance(value,list):
            for v in value: finite(v)
        elif isinstance(value,float) and not math.isfinite(value):
            raise ValueError("Nonfinite scan values")
    finite(data)
    image=data["image"];w=image["width"];h=image["height"]
    if not (isinstance(w,int) and isinstance(h,int) and 1<=w<=50000 and 1<=h<=50000):
        raise ValueError("Invalid image size")
    r=data["registration"]
    if r["eye_spacing_px"]<=0 or not 0<=r["axis_x_px"]<w or not 0<=r["eye_line_y_px"]<h:
        raise ValueError("Invalid image registration")
    cal=data.get('ocular_metrology',{}).get('calibration',{})
    if cal.get('status')=='supplied':
        if cal['mm_per_px']<=0:raise ValueError('Invalid physical calibration')
        ox,oy=cal['origin_px']
        if not (0<=ox<w and 0<=oy<h):raise ValueError('Calibration origin outside image')
    def point(p):
        if len(p)!=2 or not (0<=p[0]<w and 0<=p[1]<h):raise ValueError("Point outside image")
    evidence=list(data['features'].values())+data.get('facial_details',{}).get('observations',[])
    for f in evidence:
        if f.get("status") not in ("candidate","partial","unknown"):
            raise ValueError("Invalid evidence status")
        for run in f.get("column_runs",[]):
            last=-1
            for x,a,b in run:
                point([x,a]);point([x,b])
                if a>b or x<=last:raise ValueError("Invalid column ordering")
                last=x
        for p in f.get("centerline_px",[]):point(p)
        g=f.get('geometry_2d')
        if g:
            for key in ('width_px','height_px','area_px2'):
                if g[key]<=0:raise ValueError('Invalid ocular geometry extent')
            point(g['centroid_px'])
            if 'mm' in g:
                if cal.get('status')!='supplied':raise ValueError('Millimetres without physical calibration')
                for key in ('width','height'):
                    if not math.isclose(g['mm'][key],g[key+'_px']*cal['mm_per_px'],rel_tol=1e-9):
                        raise ValueError('Ocular millimetres disagree with calibration')
            for contour in g['contours']:
                if type(contour['hole']) is not bool or len(contour['points_px'])<4:
                    raise ValueError('Invalid ocular contour')
                for x,y in contour['points_px']:
                    if not (-.5<=x<=w-.5 and -.5<=y<=h-.5):raise ValueError('Ocular contour outside image')
        for spot in f.get("spots",[]):point(spot["center_px"])
        last=-1
        for row in f.get("rows",[]):
            y=row["y"];point([row["left"],y]);point([row["right"],y])
            if row["left"]>=row["right"] or y<=last:raise ValueError("Invalid contour ordering")
            if "occlusion_guard" in data:
                for side in ("left","right"):
                    check=row.get("fit_checks",{}).get(side,{})
                    if type(check.get("eligible")) is not bool or not isinstance(check.get("reasons"),list):
                        raise ValueError("Missing or invalid contour eligibility")
                    if check["eligible"] and check["reasons"]:
                        raise ValueError("Eligible contour sample has exclusion reasons")
            last=y
    for relation in data.get('facial_layout',{}).get('relations',{}).values():
        if relation['status'] not in ('candidate','partial','unknown'):raise ValueError('Invalid spacing status')
        if relation['status']=='unknown':
            if 'edge_gap_px' in relation:raise ValueError('Unknown spacing has a measurement')
            continue
        for x,y in relation['edge_projection_segment_px']:
            if not (-.5<=x<=w-.5 and -.5<=y<=h-.5):raise ValueError('Spacing segment outside image')
        if 'edge_gap_mm' in relation:
            if cal.get('status')!='supplied' or not math.isclose(relation['edge_gap_mm'],relation['edge_gap_px']*cal['mm_per_px'],rel_tol=1e-9,abs_tol=1e-9):
                raise ValueError('Spacing millimetres disagree with calibration')
    for segment in data.get('face_shape',{}).get('segments',[]):
        if segment['status'] not in ('candidate','partial') or segment['region'] not in ('cheek_left','cheek_right','jaw_left','jaw_right','chin'):
            raise ValueError('Invalid face shape segment')
        if len(segment['points_px'])<3:raise ValueError('Face shape segment too short')
        for p in segment['points_px']:point(p)
        expected=sum(math.dist(a,b) for a,b in zip(segment['points_px'],segment['points_px'][1:]))
        if not math.isclose(expected,segment['arc_length_px'],rel_tol=1e-9,abs_tol=1e-9):raise ValueError('Face shape length inconsistent')
        if 'points_xz_mm' in segment:
            if cal.get('status')!='supplied' or len(segment['points_xz_mm'])!=len(segment['points_px']):raise ValueError('Invalid face shape calibration')
            ox,oy=cal['origin_px'];s=cal['mm_per_px']
            for (x,y),(mx,mz) in zip(segment['points_px'],segment['points_xz_mm']):
                if not math.isclose(mx,(x-ox)*s,abs_tol=1e-8) or not math.isclose(mz,(oy-y)*s,abs_tol=1e-8):raise ValueError('Face shape millimetres inconsistent')
    return data


def validate_profile_source(data):
    profile=data.get('head_profile',{})
    if profile.get('status','unknown')=='unknown':return
    path=Path(profile['source'])
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=profile['source_sha256']:
        raise ValueError('Side reference missing or changed; rescan')
    annotation=profile.get('mask')
    if annotation:
        path=Path(annotation['path'])
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=annotation['sha256']:
            raise ValueError('Side mask missing or changed; rescan')


def polylines(data):
    """Return visible curves only. Disconnected columns stay disconnected."""
    validate_report(data)
    result=[]
    for name,f in data["features"].items():
        if f["status"]=="unknown":continue
        contours=f.get('geometry_2d',{}).get('contours')
        for i,contour in enumerate(contours or []):
            suffix=' hole' if contour['hole'] else ''
            result.append((f"{name}.{i}{suffix} [{f['status']}]",contour['points_px'],True))
        for i,run in enumerate([] if contours else f.get("column_runs",[])):
            if len(run)<2:continue
            outline=[[x,a] for x,a,b in run]+[[x,b] for x,a,b in reversed(run)]
            result.append((f"{name}.{i} [{f['status']}]",outline,True))
        if "rows" in f:
            # Break long missing scanline gaps, rather than infer hidden contour.
            for side in ("left","right"):
                segment=[];last=None
                for row in f["rows"]:
                    if not row.get("fit_checks",{}).get(side,{}).get("eligible",True):
                        if len(segment)>1:result.append((name+"."+side,segment,False))
                        segment=[];last=None
                        continue
                    if last is not None and row["y"]-last>1:
                        if len(segment)>1:result.append((name+"."+side,segment,False))
                        segment=[]
                    segment.append([row[side],row["y"]]);last=row["y"]
                if len(segment)>1:result.append((name+"."+side,segment,False))
        if name=="freckles":
            for i,spot in enumerate(f["spots"]):
                x,y=spot["center_px"];radius=math.sqrt(spot["area_px"]/math.pi)
                points=[[x+radius*math.cos(j*math.tau/12),y+radius*math.sin(j*math.tau/12)] for j in range(12)]
                result.append((f"spot candidate {i}",points,True))
    for index,s in enumerate(data.get('face_shape',{}).get('segments',[])):
        result.append((f"shape.{s['region']}.{index} [{s['status']}]",s['points_px'],False))
    for name,relation in data.get('facial_layout',{}).get('relations',{}).items():
        if relation['status']!='unknown':
            result.append((f"spacing.{name} [{relation['status']}]",relation['edge_projection_segment_px'],False))
    for item in data.get('facial_details',{}).get('observations',[]):
        for i,c in enumerate(item['geometry_2d']['contours']):
            result.append((f"detail.{item['id']}.{i} [{item['zone']}; contrast only]",c['points_px'],True))
    return result


def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)))
    return t*t*(3-2*t)


def smooth_profile(samples,top,bottom):
    """Least-squares cubic avoids imprinting pixel/ring stair steps on skin."""
    degree=min(3,len(samples)-1)
    values=[((y-top)/(bottom-top),v) for y,v in samples]
    matrix=[[sum(t**(i+j) for t,_ in values) for j in range(degree+1)]
            +[sum(v*t**i for t,v in values)] for i in range(degree+1)]
    for i in range(degree+1):
        pivot=max(range(i,degree+1),key=lambda row:abs(matrix[row][i]))
        matrix[i],matrix[pivot]=matrix[pivot],matrix[i]
        divisor=matrix[i][i]
        if abs(divisor)<1e-12:raise ValueError("Degenerate contour sampling")
        matrix[i]=[v/divisor for v in matrix[i]]
        for row in range(degree+1):
            if row==i:continue
            factor=matrix[row][i]
            matrix[row]=[a-factor*b for a,b in zip(matrix[row],matrix[i])]
    coefficients=[row[-1] for row in matrix]
    def evaluate(y):
        t=(y-top)/(bottom-top)
        return sum(c*t**i for i,c in enumerate(coefficients))
    return evaluate


def fit_segments(report,top,bottom):
    """Independent observed runs per side, never bridged through rejected rows."""
    if report.get("occlusion_guard",{}).get("version")!="hair-contact/1":
        raise ValueError("Scan lacks occlusion checks; rescan with Face Scan 0.2")
    rows=[r for r in report["features"].get("visible_skin_contour",{}).get("rows",[]) if top<=r["y"]<=bottom]
    result={};counts={}
    for side in ("left","right"):
        runs=[];current=[];last=None
        for row in rows:
            eligible=row["fit_checks"][side]["eligible"]
            if not eligible or (last is not None and row["y"]-last>1):
                if len(current)>=8:runs.append(current)
                current=[]
            if eligible:current.append(row)
            last=row["y"]
        if len(current)>=8:runs.append(current)
        result[side]=runs
        counts[side]=sum(not r["fit_checks"][side]["eligible"] for r in rows)
    if not any(result.values()):raise ValueError("No continuous eligible contour run of at least 8 rows; check occlusion overlay")
    return result,counts


def fit_face_points(points,report,axis,ground,units,top,bottom,max_step=10):
    """Adjust lower-face x only, in a registered unrigged mesh copy.

    Returns points in world coordinates. Depth and height remain unchanged.
    Target is the VISIBLE SKIN boundary, so partial/occluded rows are not truth.
    Caller chooses an observed interval; no changes outside it or at the lips.
    """
    validate_report(report)
    if not all(math.isfinite(v) for v in (axis,ground,units,top,bottom,max_step)):
        raise ValueError("Nonfinite fit settings")
    if units<=0 or max_step<=0 or top>=bottom:raise ValueError("Invalid fit settings")
    if not points or any(len(p)!=3 or any(not math.isfinite(v) for v in p) for p in points):
        raise ValueError("Invalid mesh points")
    segments,rejected=fit_segments(report,top,bottom)
    # Group existing rings by four-pixel horizontal bands.
    bins={}
    for x,y,z in points:
        py=ground-z/units
        if top-6<=py<=bottom+6:
            key=round(py/4)*4
            bins.setdefault(key,[]).append(x/units)
    if len(bins)<3:raise ValueError("Mesh has insufficient rows in fit interval; check registration")
    sl=sorted((k,min(v)) for k,v in bins.items())
    sr=sorted((k,max(v)) for k,v in bins.items())
    if any(v>=0 for _,v in sl) or any(v<=0 for _,v in sr):
        raise ValueError("Selected mesh is not centred on the registered face axis")
    plans={"left":[],"right":[]}
    for side,source_samples in (("left",sl),("right",sr)):
        for rows in segments[side]:
            a,b=rows[0]["y"],rows[-1]["y"]
            target=[(r["y"],r[side]-axis) for r in rows]
            if any(v>=0 if side=="left" else v<=0 for _,v in target):
                raise ValueError("Registration axis is outside target face")
            samples=[p for p in source_samples if a-4<=p[0]<=b+4]
            if len(samples)<3:continue
            plans[side].append((a,b,smooth_profile(samples,a,b),smooth_profile(target,a,b)))
    separation=report["registration"]["eye_spacing_px"]
    output=[];moved=0;largest=0
    for x,y,z in points:
        py=ground-z/units;dx=x/units;delta=0
        if top<py<bottom:
            for a,b,source_fn,target_fn in plans["left" if dx<0 else "right"]:
                if not a<py<b:continue
                source=source_fn(py);target=target_fn(py)
                if abs(source)<=1 or source*target<=0:continue
                raw=dx*(target/source-1)
                # Blend across the whole chosen interval. A short edge fade
                # produced horizontal creases despite smooth width profiles.
                fade=math.sin(math.pi*(py-a)/(b-a))**2
                lateral=smooth(.18*separation,.45*separation,abs(dx))
                # Short visible islands cannot support a full-size deformation:
                # taper curvature by reducing amplitude quadratically with span.
                limit=min(max_step,.15*(b-a)**2/separation)
                delta=limit*math.tanh(raw/limit)*fade*lateral
                break
        if abs(delta)>1e-6:moved+=1
        largest=max(largest,abs(delta));output.append((x+delta*units,y,z))
    return output,{"moved_vertices":moved,"maximum_step_px":largest,"interval_px":[top,bottom],
                   "target":"visible skin contour, not inferred skull anatomy","changes":"world x only",
                   "excluded_samples":rejected,
                   "fitted_intervals_px":{side:[[a,b] for a,b,_,_ in runs] for side,runs in plans.items()},
                   "regularization":"cubic width profiles; independent run blends; span-limited displacement"}


def brow_mesh(feature,axis,ground,units,depth):
    """Generate flat editable ribbons for OBSERVED brow fragments only."""
    if feature.get("status") not in ("candidate","partial"):
        raise ValueError("No observed eyebrow fragment")
    vertices=[];faces=[]
    for run in feature.get("column_runs",[]):
        start=len(vertices)
        for x,a,b in run:
            vertices.extend([((x-axis)*units,depth,(ground-a)*units),
                             ((x-axis)*units,depth,(ground-b)*units)])
        for i in range(len(run)-1):
            j=start+2*i;faces.append((j,j+1,j+3,j+2))
    if not faces:raise ValueError("Insufficient brow samples")
    return vertices,faces
