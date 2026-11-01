"""Image-only boundary checks. Passing a heuristic never proves anatomical identity."""
import numpy as np


VERSION='local-boundary-evidence/2'


def classify_boundary(rgb, valid, skin, hair, point, region, spacing):
    """Probe inward/outward strips along the measurement axis, not model geometry.

    Hair beyond the old proximity guard and illumination-like colour changes
    make skin-mask extrema unsafe silhouette targets. Unknown stays unknown;
    neither the opposite cheek nor a model render supplies missing evidence.
    """
    h,w=valid.shape;x,y=np.rint(point).astype(int)
    direction=np.array([0,1]) if region=='chin' else np.array([-1,0] if region.endswith('_left') else [1,0])
    tangent=np.array([-direction[1],direction[0]])
    radius=max(3,int(round(spacing*.10)));near=max(2,int(round(spacing*.025)))
    def strip(distances):
        coords=np.array([np.array([x,y])+direction*d+tangent*t for d in distances for t in (-1,0,1)])
        if np.any(coords<0) or np.any(coords>=[w,h]):return None
        return coords[:,1],coords[:,0]
    inside=strip(range(-near,-near*2-1,-1));outside=strip(range(near,radius+1))
    contact=strip(range(-1,radius+1))
    result={'point_px':list(map(float,point)),'classification':'unknown','eligible':False,'reasons':[]}
    if inside is None or outside is None or contact is None:
        result['reasons']=['probe_outside_image'];return result
    if not valid[y,x] or not valid[inside].all():
        result['reasons']=['invalid_inward_pixels'];return result
    support=float(skin[inside].mean());result['inward_skin_fraction']=support
    if support<.5:result['reasons'].append('inward_skin_unsupported')
    hair_fraction=float((hair[contact]&valid[contact]).mean());result['outward_hair_fraction']=hair_fraction
    if hair_fraction>=.10:result['reasons'].append('outward_hair_contact')
    exterior_valid=valid[outside]
    if not exterior_valid.all():
        # Transparent RGB is never used as colour evidence.
        result['classification']='alpha_boundary_candidate' if not exterior_valid.any() else 'mixed_alpha_boundary'
        if exterior_valid.any():result['reasons'].append('mixed_alpha_probe')
    else:
        inner=np.median(rgb[inside].astype(float),axis=0);outer=np.median(rgb[outside].astype(float),axis=0)
        contrast=float(np.linalg.norm(inner-outer));ratio=float(outer@inner/max(float(inner@inner),1.))
        residual=float(np.linalg.norm(outer-ratio*inner)/max(float(np.linalg.norm(outer)),1.))
        result.update(contrast_rgb=contrast,illumination_ratio=ratio,chromatic_residual=residual)
        if contrast<18:result['reasons'].append('weak_boundary_contrast')
        if .20<=ratio<=.92 and residual<=.08:result['reasons'].append('illumination_like_transition')
        if float(skin[outside].mean())>.5:result['reasons'].append('skin_continues_outward')
        result['classification']='contrast_boundary_candidate'
    if 'outward_hair_contact' in result['reasons']:result['classification']='hair_contact_candidate'
    elif 'illumination_like_transition' in result['reasons']:result['classification']='shadow_ambiguous'
    elif result['reasons']:result['classification']='unknown'
    result['eligible']=not result['reasons']
    return result


def chin_neck_context(points, observations, jaw_points, skin, valid, spacing, axis_x):
    """Test a measured chin arc against bilateral jaw attachment and neck narrowing.

    This is a contextual candidate, not semantic ground truth. It can resolve
    skin continuation/illumination ambiguity only; it never invents samples or
    overrides hair, weak contrast, transparency, or missing image evidence.
    """
    p=np.asarray(points,float);h,w=skin.shape
    report={'status':'unknown','reasons':[],'metrics':{},'resolved_local_reasons':[],
            'scope':'Observed arc and skin topology; a painted lookalike can remain indistinguishable from contact.'}
    def fail(reason):
        report['reasons'].append(reason)
        return report
    if len(p)<5 or p.ndim!=2 or p.shape[1]!=2 or not np.isfinite(p).all():return fail('invalid_chin_arc')
    x,y=p.T;span=float(np.ptp(x));metrics=report['metrics']
    metrics['span_eye_units']=span/spacing
    if span<spacing*.45 or not x[0]<axis_x<x[-1]:return fail('central_span_insufficient')
    if np.any(np.diff(x)<=0) or np.any(np.diff(x)>1.01):return fail('arc_has_missing_columns')
    allowed={'skin_continues_outward','illumination_like_transition'}
    if any(set(o['reasons'])-allowed for o in observations):return fail('arc_has_hard_exclusion')
    # A fitted curve measures consistency only. It never replaces source points.
    q=(x-axis_x)/spacing;coeff=np.polyfit(q,y/spacing,2);residual=np.abs(np.polyval(coeff,q)*spacing-y)
    metrics.update(curve_p95_px=float(np.percentile(residual,95)),curvature=float(coeff[0]),
                   maximum_sample_slope=float(np.max(np.abs(np.diff(y)/np.diff(x)))))
    center=(abs(x-axis_x)<=spacing*.08)
    sag=float(np.median(y[center])-(y[0]+y[-1])/2);metrics['central_sag_px']=sag
    if metrics['curve_p95_px']>max(1.5,spacing*.015) or coeff[0]>=-.04 or sag<spacing*.02 or metrics['maximum_sample_slope']>1.5:
        return fail('arc_not_smooth_lower_convex_boundary')
    attachments={}
    for side,end in (('left',p[0]),('right',p[-1])):
        jaw=np.asarray(jaw_points.get(side,[]),float)
        if len(jaw)<3:return fail('missing_supported_jaw_'+side)
        distances=np.linalg.norm(jaw-end,axis=1);index=int(np.argmin(distances));anchor=jaw[index]
        attachments[side]={'point_px':anchor.tolist(),'distance_px':float(distances[index])}
        if distances[index]>max(3.,spacing*.06):return fail('disconnected_jaw_'+side)
        # Require observed jaw continuation toward the outer upper face, not an isolated dot.
        outer=jaw[:,0]<end[0]-spacing*.04 if side=='left' else jaw[:,0]>end[0]+spacing*.04
        if not np.any(outer & (jaw[:,1]<end[1])):return fail('jaw_direction_unsupported_'+side)
    report['jaw_attachments']=attachments
    bottom=float(np.max(y[center]));probe_x=np.arange(round(axis_x-spacing*.85),round(axis_x+spacing*.85)+1)
    before_y=[round(bottom-spacing*f) for f in (.18,.22,.26)]
    after_y=[round(bottom+spacing*f) for f in (.04,.08,.12)]
    if probe_x.min()<0 or probe_x.max()>=w or min(before_y)<0 or max(after_y)>=h:
        return fail('neck_probe_outside_image')
    def component_at_axis(row):
        if not valid[row,probe_x].all():return None
        values=skin[row,probe_x];i=int(np.argmin(abs(probe_x-axis_x)))
        if not values[i]:return None
        lo=hi=i
        while lo>0 and values[lo-1]:lo-=1
        while hi<len(values)-1 and values[hi+1]:hi+=1
        # An unbounded run does not supply a measured neck width.
        if lo==0 or hi==len(values)-1:return None
        return [int(probe_x[lo]),int(probe_x[hi])]
    before=[component_at_axis(row) for row in before_y];after=[component_at_axis(row) for row in after_y]
    report['skin_cross_sections']={'before':[{'y_px':row,'interval_px':interval} for row,interval in zip(before_y,before)],
                                   'after':[{'y_px':row,'interval_px':interval} for row,interval in zip(after_y,after)]}
    if any(interval is None for interval in before+after):return fail('neck_cross_sections_unresolved')
    upper=np.array([b-a+1 for a,b in before],float);lower=np.array([b-a+1 for a,b in after],float)
    metrics.update(neck_to_face_width_ratio=float(np.median(lower)/np.median(upper)),
                   neck_width_variation=float(np.ptp(lower)/np.median(lower)))
    if not (spacing*.15<=np.median(lower)<=spacing*.75) or metrics['neck_to_face_width_ratio']>.65 or metrics['neck_width_variation']>.30:
        return fail('no_stable_narrow_neck')
    if any(a<x[0]-spacing*.08 or b>x[-1]+spacing*.08 for a,b in after):return fail('neck_not_beneath_arc')
    report.update(status='candidate',resolved_local_reasons=sorted({reason for o in observations for reason in o['reasons']}))
    return report
