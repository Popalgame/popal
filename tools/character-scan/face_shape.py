"""Observed cheek/jaw/chin curves and registered deviations, never a 3D likeness score."""
import csv
import math

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from scipy.spatial import cKDTree
from contour_evidence import classify_boundary, chin_neck_context, VERSION as EVIDENCE_VERSION

REGIONS=('cheek_left','cheek_right','jaw_left','jaw_right','chin')
COLORS={'cheek_left':'#74dfff','cheek_right':'#74dfff','jaw_left':'#ffca64','jaw_right':'#ffca64','chin':'#76ff9b'}


def runs(points, axis, max_jump):
    """Break missing samples and discontinuities instead of filling hidden anatomy."""
    result=[];current=[]
    for p in points:
        if current and (p[axis]-current[-1][axis]>1.01 or math.dist(p,current[-1])>max_jump):
            if len(current)>=3:result.append(current)
            current=[]
        current.append(p)
    if len(current)>=3:result.append(current)
    return result


def describe(region,points,status,method,cal):
    length=sum(math.dist(a,b) for a,b in zip(points,points[1:]))
    result={'region':region,'status':status,'points_px':points,'arc_length_px':length,'method':method}
    # End-to-end inclination describes a fragment, not an anatomical jaw angle.
    dx,dy=np.subtract(points[-1],points[0])
    result['chord_angle_degrees']=math.degrees(math.atan2(dy,dx))
    chord=math.hypot(dx,dy)
    if chord:
        deviation=max(abs(dx*(p[1]-points[0][1])-dy*(p[0]-points[0][0]))/chord for p in points)
        result['chord_length_px']=chord
        result['max_chord_deviation_px']=deviation
        result['fragment_bow_ratio']=deviation/chord
        result['bow_note']='curvature descriptor of this visible fragment; compare only with equal visible span'
    if cal['status']=='supplied':
        s=cal['mm_per_px'];ox,oy=cal['origin_px']
        result['arc_length_mm']=length*s
        if chord:result['max_chord_deviation_mm']=deviation*s
        result['points_xz_mm']=[[(x-ox)*s,(oy-y)*s] for x,y in points]
    return result


def annotation_segments(value,report,valid):
    if not isinstance(value,dict) or set(value)!={'source_sha256','segments'} or value['source_sha256']!=report['source_sha256']:
        raise ValueError('face_outline requires matching source_sha256 and segments')
    if not isinstance(value['segments'],list) or not value['segments']:raise ValueError('face_outline segments must be a nonempty list')
    w,h=report['image']['width'],report['image']['height'];result=[]
    for segment in value['segments']:
        if not isinstance(segment,dict) or set(segment)!={'region','points_px','status'}:
            raise ValueError('Outline segment needs region, points_px and status')
        region=segment['region'];points=segment['points_px'];status=segment['status']
        if region not in REGIONS or status not in ('candidate','partial'):raise ValueError('Invalid outline region/status')
        if not isinstance(points,list) or len(points)<3:raise ValueError('Outline needs at least three ordered points')
        progress=0 if region=='chin' else 1
        for i,p in enumerate(points):
            if not isinstance(p,list) or len(p)!=2 or any(type(v) not in (int,float) or not math.isfinite(v) for v in p):
                raise ValueError('Invalid outline point')
            x,y=p
            if not (0<=x<w and 0<=y<h) or not valid[int(y),int(x)]:raise ValueError('Outline point outside visible image')
            if i and p[progress]<=points[i-1][progress]:raise ValueError('Outline must run top-to-bottom, or left-to-right for chin')
            if i and math.dist(p,points[i-1])>report['registration']['eye_spacing_px']*.15:
                raise ValueError('Outline segment bridges a large gap; split it or supply denser visible points')
        result.append(segment)
    return result


def analyse_shape(report,masks,rgb,valid,annotation=None):
    reg=report['registration'];cx,ey,sep=reg['axis_x_px'],reg['eye_line_y_px'],reg['eye_spacing_px']
    cal=report['ocular_metrology']['calibration'];h,w=valid.shape;roi=report['roi_px']
    lum=ndi.gaussian_filter(rgb.astype(float)@np.array([.2126,.7152,.0722]),.7)
    radius=max(1,round(sep*.018));points=[]
    y0=max(roi[1]+radius,round(ey+sep*.70));y1=min(roi[3]-radius-1,round(ey+sep*1.06))
    # A dark transition below central facial skin is evidence for a boundary,
    # not proof of the chin. No optimum path is drawn through weak/missing pixels.
    for x in range(max(roi[0]+radius,round(cx-sep*.32)),min(roi[2]-radius,round(cx+sep*.32)+1)):
        ys=np.arange(y0,y1)
        if not len(ys):continue
        contrast=lum[ys-radius,x]-lum[ys+radius,x]
        supported=valid[ys-radius,x]&valid[ys+radius,x]&masks['skin'][ys-radius,x]
        supported &= ~masks['hair'][ys-radius,x]&~masks['hair'][ys+radius,x]
        candidates=np.where(supported,contrast,-np.inf)
        i=int(candidates.argmax())
        if candidates[i]>=14:points.append([int(x),int(ys[i])])
    chin_runs=[r for r in runs(points,0,max(3,sep*.035)) if len(r)>=max(5,round(sep*.10)) and r[0][0]<=cx<=r[-1][0]]
    supplied=annotation_segments(annotation,report,valid) if annotation is not None else []
    replacements={s['region'] for s in supplied};segments=[]
    for points in chin_runs:
        if 'chin' not in replacements:
            segments.append(describe('chin',points,'partial','central downward contrast transition; chin identity unverified',cal))
    for s in supplied:segments.append(describe(s['region'],s['points_px'],s['status'],'source-matched annotated visible polyline',cal))
    central=[p for s in segments if s['region']=='chin' for p in s['points_px'] if abs(p[0]-cx)<=sep*.08]
    bottom={'status':'unknown','reason':'No supported central chin boundary; neck must not become chin'}
    chin_y=None
    if central:
        tip=max(central,key=lambda p:p[1]);chin_y=tip[1]
        bottom={'status':'partial' if any(s['status']=='partial' for s in segments if s['region']=='chin') else 'candidate',
                'point_px':tip,'eye_line_to_chin_px':chin_y-ey,
                'axis_offset_px':tip[0]-cx,'definition':'lowest observed point near face axis, not recovered 3D chin tip'}
        if cal['status']=='supplied':
            bottom['eye_line_to_chin_mm']=(chin_y-ey)*cal['mm_per_px']
            bottom['axis_offset_mm']=(tip[0]-cx)*cal['mm_per_px']
    rows=report['features']['visible_skin_contour']['rows'];diagnostics={}
    upper_limit=min(chin_y-radius if chin_y is not None else ey+sep*.75,roi[3]-3)
    for side in ('left','right'):
        for region,a,b in ((f'cheek_{side}',ey,ey+sep*.45),(f'jaw_{side}',ey+sep*.45,upper_limit)):
            candidates=[r for r in rows if a<=r['y']<b]
            reasons={}
            for row in candidates:
                for reason in row['fit_checks'][side]['reasons']:
                    reasons[reason]=reasons.get(reason,0)+1
                if not valid[row['y'],row[side]]:reasons['invalid_source_pixel']=reasons.get('invalid_source_pixel',0)+1
            diagnostics[region]={'source':'annotation' if region in replacements else 'guarded_skin_boundary',
                'candidate_rows':len(candidates),'eligible_rows':sum(r['fit_checks'][side]['eligible'] and bool(valid[r['y'],r[side]]) for r in candidates),
                'rejected_reasons':reasons,'search_y_px':[float(a),float(b)]}
            if region in replacements:continue
            points=[[float(r[side]),float(r['y'])] for r in rows if a<=r['y']<b and r['fit_checks'][side]['eligible']
                    and valid[r['y'],r[side]]]
            for run in runs(points,1,max(3,sep*.06)):
                segments.append(describe(region,run,'partial','guarded warm-skin row boundary; hidden extent unknown',cal))
    # Coverage alone cannot turn a skin/hair edge or a shadow into a face silhouette.
    # Keep rejected observations for diagnosis, but remove them from all consumers
    # (fit, widths and automatic chin landmarks). Explicit annotations retain origin.
    audited=[];observations=[];segment_observations=[];contexts=[]
    for index,segment in enumerate(segments):
        region=segment['region'];supplied_region=region in replacements;items=[]
        for point in segment['points_px']:
            item=classify_boundary(rgb,valid,masks['skin'],masks['hair'],point,region,sep)
            item.update(region=region,origin='annotation' if supplied_region else 'automatic',segment_index=index)
            items.append(item)
        segment_observations.append(items);observations.extend(items)
    jaw_points={side:[o['point_px'] for o in observations if o['region']=='jaw_'+side and o['eligible']] for side in ('left','right')}
    for index,(segment,items) in enumerate(zip(segments,segment_observations)):
        region=segment['region'];supplied_region=region in replacements;accepted=[];context=None
        if region=='chin' and not supplied_region:
            context=chin_neck_context(segment['points_px'],items,jaw_points,masks['skin'],valid,sep,cx)
            context['segment_index']=index;contexts.append(context)
        for item in items:
            if context and context['status']=='candidate':
                item.update(local_classification=item['classification'],local_reasons=list(item['reasons']),
                            classification='chin_neck_contact_candidate',eligible=True,reasons=[],context_index=len(contexts)-1)
            item['used_for_fit']=supplied_region or item['eligible']
            if item['used_for_fit']:accepted.append(item['point_px'])
        if supplied_region:
            segment['boundary_evidence']='source_annotation';audited.append(segment);continue
        for fragment in runs(accepted,0 if region=='chin' else 1,max(3,sep*(.035 if region=='chin' else .06))):
            if region=='chin' and not (len(fragment)>=max(5,round(sep*.10)) and fragment[0][0]<=cx<=fragment[-1][0]):continue
            item=describe(region,fragment,segment['status'],segment['method'],cal)
            item['boundary_evidence']='chin_neck_contact_candidate' if context and context['status']=='candidate' else 'heuristic_candidate';audited.append(item)
    used={(s['region'],tuple(p)) for s in audited for p in s['points_px']}
    for item in observations:
        if item['used_for_fit'] and (item['region'],tuple(item['point_px'])) not in used:
            item['used_for_fit']=False;item['reasons'].append('insufficient_contiguous_fragment')
    segments=audited
    central=[p for s in segments if s['region']=='chin' for p in s['points_px'] if abs(p[0]-cx)<=sep*.08]
    if not central:
        chin_y=None;bottom={'status':'unknown','reason':'No central chin fragment survived boundary evidence checks'}
    else:
        tip=max(central,key=lambda p:p[1]);chin_y=tip[1]
        bottom.update(point_px=tip,eye_line_to_chin_px=chin_y-ey,axis_offset_px=tip[0]-cx)
        if cal['status']=='supplied':
            bottom.update(eye_line_to_chin_mm=(chin_y-ey)*cal['mm_per_px'],axis_offset_mm=(tip[0]-cx)*cal['mm_per_px'])
    for region in REGIONS:
        selected=[o for o in observations if o['region']==region];reasons={}
        for item in selected:
            if not item['used_for_fit']:
                for reason in item['reasons']:reasons[reason]=reasons.get(reason,0)+1
        diagnostics.setdefault(region,{'source':'annotation' if region in replacements else 'central_contrast_boundary'})
        diagnostics[region]['boundary_evidence']={'examined_samples':len(selected),
            'retained_samples':sum(o['used_for_fit'] for o in selected),'rejected_reasons':reasons,
            'context_supported_samples':sum(o['used_for_fit'] and o['classification']=='chin_neck_contact_candidate' for o in selected),
            'annotation_warning_samples':sum(bool(o['reasons']) for o in selected if o['origin']=='annotation')}
    boundary_evidence={'version':EVIDENCE_VERSION,'source_sha256':report['source_sha256'],
        'scope':'Image-only heuristic rejection; retained contrast candidates are not verified anatomical silhouettes.',
        'probe_radius_px':max(3,int(round(sep*.10))),'observations':observations,'chin_context':contexts,
        'limitations':['Undetected hair and non-neutral shadows can escape these checks.',
                      'Illumination-like transitions may be real boundaries; rejection is conservative.',
                      'Context-supported chin/neck contact remains a hypothesis; painted lookalikes may pass.',
                      'Source-matched annotations retain their explicit origin; heuristic warnings remain visible.']}
    widths=[]
    # Measured scanlines only: no interpolation over an occluded cheek/jaw.
    wanted=[('below_eyes_25pct',round(ey+sep*.25)),('below_eyes_50pct',round(ey+sep*.5))]
    if chin_y is not None:
        wanted += [('above_chin_'+str(pct)+'pct',round(chin_y-sep*pct/100)) for pct in (5,10,20)]
    for name,y in wanted:
        item={'name':name,'y_px':y,'status':'unknown','reason':'Both visible side boundaries required'}
        sides={}
        for side in ('left','right'):
            samples=[p for s in segments if s['region'].endswith('_'+side) for p in s['points_px'] if abs(p[1]-y)<.01]
            if samples:sides[side]=samples[0][0]
        if len(sides)==2 and sides['left']<sides['right']:
            width=sides['right']-sides['left']
            item={'name':name,'y_px':y,'status':'partial','left_px':sides['left'],'right_px':sides['right'],
                  'width_px':width,'center_offset_px':(sides['left']+sides['right'])/2-cx,
                  'definition':'distance between sampled boundary points; not pixel-cell occupied width'}
            if cal['status']=='supplied':item['width_mm']=width*cal['mm_per_px']
        widths.append(item)
    counts={r:sum(len(s['points_px']) for s in segments if s['region']==r) for r in REGIONS}
    report['face_shape']={'version':'1.5','status':'partial' if segments else 'unknown','segments':segments,
                          'boundary_evidence':boundary_evidence,
                          'chin_bottom':bottom,'width_samples':widths,'sample_counts':counts,'region_diagnostics':diagnostics,
                          'annotation':annotation,'registration':reg,'calibration':cal,
                          'accuracy_100_percent_verified':False,'depth_status':'unknown',
                          'scope':'Visible projected boundaries and contrast candidates; not full facial surface or recovered skull.',
                          'limitations':['No interpolation through missing or rejected evidence.',
                                         'Automatic chin transitions can be cast shadows or neck boundaries; review overlay.',
                                         'An exact sampled 2D match does not establish 3D shape or semantic correctness.']}


def sampled(shape,region):
    """Uniform arc samples within each visible segment; no joining between fragments."""
    reg=shape['registration'];sep=reg['eye_spacing_px'];result=[];intervals=[]
    axis=0 if region=='chin' else 1
    for s in shape['segments']:
        if s['region']!=region:continue
        points=(np.asarray(s['points_px'],float)-[reg['axis_x_px'],reg['eye_line_y_px']])/sep
        arc=np.r_[0,np.cumsum(np.linalg.norm(np.diff(points,axis=0),axis=1))]
        if arc[-1]<=0:continue
        t=np.linspace(0,arc[-1],max(2,math.ceil(arc[-1]/.005)+1))
        result.append(np.column_stack([np.interp(t,arc,points[:,i]) for i in (0,1)]))
        intervals.append([float(points[:,axis].min()),float(points[:,axis].max())])
    return (np.concatenate(result) if result else np.empty((0,2))),intervals


def compare_shapes(a,b):
    result={'status':'unknown','regions':{},'accuracy_100_percent_verified':False,
            'registration':'translation by face axis/eye line, uniform scale by iris-search eye spacing; no shape warping',
            'scope':'deviation on mutually covered visible fragments; not overall likeness, depth or hidden-surface accuracy'}
    if not a or not b:return result
    for region in REGIONS:
        pa,ia=sampled(a,region);pb,ib=sampled(b,region);axis=0 if region=='chin' else 1
        def covered(points,intervals):
            keep=np.zeros(len(points),bool)
            for lo,hi in intervals:keep|=(points[:,axis]>=lo-1e-9)&(points[:,axis]<=hi+1e-9)
            return points[keep]
        qa,qb=covered(pa,ib),covered(pb,ia)
        item={'status':'unknown','reference_samples':len(pa),'candidate_samples':len(pb),
              'reference_coverage':len(qa)/len(pa) if len(pa) else 0,
              'candidate_coverage':len(qb)/len(pb) if len(pb) else 0}
        if len(qa)>=3 and len(qb)>=3:
            da,index=cKDTree(qb).query(qa);db,_=cKDTree(qa).query(qb);dist=np.r_[da,db]
            item.update(status='partial',mean_distance_eye_units=float(dist.mean()),
                        p95_distance_eye_units=float(np.percentile(dist,95)),max_distance_eye_units=float(dist.max()),
                        worst_reference_pair_eye_units=[qa[int(da.argmax())].tolist(),qb[index[int(da.argmax())]].tolist()])
            if a['calibration']['status']=='supplied':
                scale=a['registration']['eye_spacing_px']*a['calibration']['mm_per_px']
                for key in ('mean','p95','max'):item[key+'_distance_reference_mm']=item[key+'_distance_eye_units']*scale
                item['mm_note']='registered deviation expressed at reference physical scale, not absolute-world displacement'
            result['status']='partial'
        result['regions'][region]=item
    return result


def save_shape(report,rgb,out):
    shape=report['face_shape'];im=Image.fromarray(rgb);draw=ImageDraw.Draw(im)
    for s in shape['segments']:draw.line([tuple(p) for p in s['points_px']],fill=COLORS[s['region']],width=2)
    for item in shape['width_samples']:
        if item['status']!='unknown':draw.line((item['left_px'],item['y_px'],item['right_px'],item['y_px']),fill='#f69bff',width=1)
    tip=shape['chin_bottom'].get('point_px')
    if tip:
        x,y=tip;draw.ellipse((x-3,y-3,x+3,y+3),outline='white',width=2)
    crop=im.crop(report['roi_px']);crop=crop.resize((crop.width*2,crop.height*2))
    sheet=Image.new('RGB',(max(850,crop.width),crop.height+100),(24,31,38));sheet.paste(crop,(0,0));d=ImageDraw.Draw(sheet)
    for i,text in enumerate(('CYAN: cheek fragments | GOLD: jaw fragments | GREEN: chin contrast candidates',
                              'MAGENTA: sampled widths | WHITE: central lowest boundary candidate',
                              'Gaps stay unknown. Front-view observations do not establish complete 3D geometry.')):
        d.text((12,crop.height+15+i*25),text,fill='white')
    sheet.save(out/'face-shape-overlay.png')
    evidence=shape.get('boundary_evidence')
    if evidence:
        import json
        (out/'boundary-evidence.json').write_text(json.dumps(evidence,indent=2,allow_nan=False)+'\n')
        audit=Image.fromarray(rgb);d=ImageDraw.Draw(audit)
        for item in evidence['observations']:
            x,y=item['point_px'];color=('#7dd3ff' if item['classification']=='chin_neck_contact_candidate' else '#76ff9b') if item['used_for_fit'] else '#ff536e'
            d.ellipse((x-1,y-1,x+1,y+1),fill=color)
        audit=audit.crop(report['roi_px']);audit=audit.resize((audit.width*2,audit.height*2))
        sheet=Image.new('RGB',(max(850,audit.width),audit.height+65),(24,31,38));sheet.paste(audit,(0,0));d=ImageDraw.Draw(sheet)
        d.text((12,audit.height+12),'GREEN: local / annotated | CYAN: contextual chin-neck candidate | RED: rejected',fill='white')
        d.text((12,audit.height+37),'Local colour/hair checks are heuristics, not proof of an anatomical silhouette.',fill='white')
        sheet.save(out/'boundary-evidence-overlay.png')
    with (out/'face-shape-widths.csv').open('w',newline='') as stream:
        writer=csv.writer(stream);keys=['name','status','y_px','left_px','right_px','width_px','width_mm','center_offset_px']
        writer.writerow(keys)
        for row in shape['width_samples']:writer.writerow([row.get(k) for k in keys])
    with (out/'face-shape-points.csv').open('w',newline='') as stream:
        writer=csv.writer(stream);writer.writerow(['segment','region','status','x_px','y_px','x_mm','z_mm'])
        for index,s in enumerate(shape['segments']):
            for i,p in enumerate(s['points_px']):writer.writerow([index,s['region'],s['status'],*p,*s.get('points_xz_mm',[[None,None]]*len(s['points_px']))[i]])


def save_comparison(a,b,out):
    if not a or not b:return
    canvas=Image.new('RGB',(1000,650),(24,31,38));d=ImageDraw.Draw(canvas)
    def point(p):return (500+p[0]*260,100+p[1]*260)
    for shape,color in ((a,'#e9e9ed'),(b,'#45ddc1')):
        reg=shape['registration'];sep=reg['eye_spacing_px']
        for s in shape['segments']:
            d.line([point([(x-reg['axis_x_px'])/sep,(y-reg['eye_line_y_px'])/sep]) for x,y in s['points_px']],fill=color,width=2)
    comparison=compare_shapes(a,b)
    d.text((20,18),'WHITE: reference | TEAL: candidate | eye-registered visible face/chin curves',fill='white')
    d.text((20,45),'Missing arcs remain unknown. No 100% likeness or 3D accuracy score.',fill='#f2c17b')
    for i,(region,item) in enumerate(comparison['regions'].items()):
        text=region+': '+item['status']
        if 'mean_distance_eye_units' in item:
            text+=f" | mean {item['mean_distance_eye_units']:.4f} eye units | coverage {item['reference_coverage']:.0%}/{item['candidate_coverage']:.0%}"
        d.text((20,485+i*25),text,fill='white')
    if out.exists():raise FileExistsError(out)
    canvas.save(out)
