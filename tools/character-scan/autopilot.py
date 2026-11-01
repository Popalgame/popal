"""Deterministic face-outline autopilot; no LLM-authored vertex edits.

An initial isolated face snapshot and source-bound orthographic camera form
the asset contract. Scanning, deformation controls, trials, rollback and
regional acceptance run in software. This is not full character generation.
"""
import copy
import json
from pathlib import Path

import numpy as np

from mesh_fit import fit_mesh, render_silhouette
from mesh_snapshot import job_digest, mesh_digest, verify_result
from metrology3d import project
from outline_objective import REGIONS, measure_outline, validate_segments, frozen_outline_error, edge_shear
from fit_diagnosis import diagnose
from control_reach import control_reach, overlay as reach_overlay


class Blocked(ValueError):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def write(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n')


def outline_readiness(scan):
    """Explain the same regional gates used by fitting, without filling missing evidence."""
    shape=scan.get('face_shape',{});segments=shape.get('segments',[])
    sep=float(scan['registration']['eye_spacing_px']);regions={}
    for region in REGIONS:
        selected=[s for s in segments if s['region']==region];axis=0 if region=='chin' else 1
        intervals=[(min(p[axis] for p in s['points_px']),max(p[axis] for p in s['points_px'])) for s in selected if s['points_px']]
        merged=[]
        for lo,hi in sorted(intervals):
            if merged and lo<=merged[-1][1]:merged[-1][1]=max(hi,merged[-1][1])
            else:merged.append([lo,hi])
        span=sum(hi-lo for lo,hi in merged);count=sum(len(s['points_px']) for s in selected)
        status='missing' if count<3 else 'low_coverage' if span<sep*.08 else 'sufficient'
        regions[region]={'status':status,'samples':count,'visible_span_px':span,'required_span_px':sep*.08,
                         'scanner':copy.deepcopy(shape.get('region_diagnostics',{}).get(region,{}))}
    missing=[r for r,g in regions.items() if g['status']=='missing']
    low=[r for r,g in regions.items() if g['status']=='low_coverage']
    return {'schema':'polpal.outline-readiness/1','source_sha256':scan.get('source_sha256'),
            'status':'blocked' if missing or low else 'sufficient','regions':regions,
            'missing_regions':missing,'low_coverage_regions':low,
            'scope':'Observed contour coverage only; sufficient coverage does not confirm semantic accuracy.',
            'next_action':'Provide a reference with the missing contour visible, or a source-matched annotation of genuinely visible fragments. Do not trace through hair or mirror the other cheek.' if missing or low else None}


def bridge_gaps(mutable, max_gap):
    """Merge same-side fragments separated by at most max_gap unobserved rows.

    A frozen short gap between two moved fragments leaves a step in the
    silhouette. Bridged rows are interpolation, recorded separately, not data.
    """
    merged = {}
    gaps = {}
    for side, intervals in mutable.items():
        merged[side] = []
        gaps[side] = []
        for lo, hi in sorted(intervals):
            if merged[side] and lo-merged[side][-1][1] <= max_gap:
                if lo > merged[side][-1][1]:
                    gaps[side].append([merged[side][-1][1], lo])
                merged[side][-1][1] = max(hi, merged[side][-1][1])
            else:
                merged[side].append([lo, hi])
    return merged, gaps


def local_controls(vertices, triangles, camera, size, segments, mutable, inverse, cx, sep, fraction, smooth):
    """Overlapping lateral bands along each observed fragment.

    One control per side cannot widen one part of a jaw while narrowing
    another. Bands form a partition of unity in image rows, so neighbouring
    controls blend smoothly. Lateral weight is relative to the silhouette edge
    in the same row, not to a fixed distance from the axis, so a narrow lower
    jaw is not attenuated. One unit moves the edge by a known number of pixels,
    sized from the error measured in that band and bounded by eye spacing.
    """
    from collections import Counter
    xy = project(vertices, camera)
    mask = render_silhouette(vertices, np.asarray(triangles), camera, size)
    height, width = mask.shape
    rows = np.clip(np.rint(xy[:, 1]).astype(int), 0, height-1)
    occupied = mask.any(axis=1)
    taper = max(2., sep*.035)
    spacing = max(2*taper, sep*.06)
    floor = sep*fraction
    ceiling = max(floor, sep*.25)
    controls = []
    names = Counter()
    for side, sign in (('left', -1), ('right', 1)):
        edge = np.where(occupied, mask.argmax(axis=1) if side == 'left' else width-1-mask[:, ::-1].argmax(axis=1), -1)
        boundary = edge-.5 if side == 'left' else edge+.5
        half = np.where(occupied, sign*(boundary-cx), 0.)[rows]
        reach = np.where(half > 1, sign*(xy[:, 0]-cx)/np.maximum(half, 1), 0.)
        # A gentle ramp over most of the half-row lets the edge move inward by
        # a large share of the half-width without overtaking inner vertices.
        lateral_weight = np.clip((reach-.15)/.85, 0, 1)
        points = [(p, s['region']) for s in segments if s['region'] != 'chin' and s['region'].endswith('_'+side) for p in s['points_px']]
        for lo, hi in mutable[side]:
            # Each band stays inside its own fragment, never a neighbouring one.
            fragment = smooth(lo, lo+taper, xy[:, 1])*(1-smooth(hi-taper, hi, xy[:, 1]))
            count = max(1, int(np.ceil((hi-lo)/spacing)))
            centers = np.linspace(lo, hi, count) if count > 1 else [(lo+hi)/2]
            gap = (hi-lo)/(count-1) if count > 1 else None
            for center in centers:
                if gap:
                    hat = np.clip(1-abs(xy[:, 1]-center)/gap, 0, 1)
                    hat = hat*hat*(3-2*hat)
                    # Whole hat support, so a band centred in a bridged gap still
                    # sizes itself from the observed rows on either side.
                    near = [(p, r) for p, r in points if lo <= p[1] <= hi and abs(p[1]-center) <= gap]
                else:
                    hat = np.ones(len(vertices))
                    near = [(p, r) for p, r in points if lo <= p[1] <= hi]
                weight = hat*lateral_weight*fragment
                if not near or weight.max() < 1e-9:
                    continue
                errors = [abs(boundary[int(round(y))]-x) for (x, y), _ in near if occupied[int(round(y))]]
                amplitude = float(np.clip(1.25*max(errors, default=0.), floor, ceiling))
                at_edge = weight[(reach > .9) & (abs(xy[:, 1]-center) <= max((gap or hi-lo)/2, 1))]
                peak = float(at_edge.max()) if at_edge.size and at_edge.max() > 0 else float(weight.max())
                region = Counter(r for _, r in near).most_common(1)[0][0]
                names[region] += 1
                # Normalise to the edge, but no vertex may exceed the band ceiling.
                scale = min(amplitude/max(peak, .25), ceiling/float(weight.max()))
                offsets = (weight*scale*sign)[:, None]*inverse[:, 0]
                controls.append({'name': f'{region}_{names[region]}', 'min': -1, 'max': 1,
                                 'edge_px_per_unit': float(min(amplitude, peak*scale)), 'offsets': offsets.tolist()})
    return controls, floor


def prepare_job(snapshot, scan, camera, config=None):
    config = config or {}
    mode=config.get('coverage_mode','full')
    if mode not in ('full','auto'):raise ValueError('coverage_mode must be full or auto')
    mesh = snapshot['mesh']
    if mesh.get('semantic_role') != 'isolated_face':
        raise Blocked('face_binding_required', 'Snapshot must identify an isolated face mesh: mesh.semantic_role=isolated_face')
    if mesh_digest(mesh['vertices'], mesh['triangles']) != mesh.get('sha256'):
        raise ValueError('Source mesh checksum mismatch')
    if not camera:
        raise Blocked('camera_required', 'Calibrate the reference camera with model/reference correspondences first')
    if camera.get('source_sha256') != scan.get('source_sha256') or not scan.get('source_sha256'):
        raise Blocked('camera_source_mismatch', 'Camera is not bound to this reference image')
    if camera.get('status') not in ('calibrated', 'candidate'):
        raise Blocked('camera_required', 'Camera is unresolved')
    matrix = np.asarray(camera['P'], float)
    if matrix.shape != (3, 4) or not np.isfinite(matrix).all():
        raise ValueError('Invalid camera projection')
    if np.linalg.norm(matrix[2, :3]) > 1e-10 or abs(matrix[2, 3]) < 1e-12:
        raise Blocked('perspective_not_supported', 'Automatic face controls currently require an orthographic camera')
    matrix = matrix / matrix[2, 3]
    if np.linalg.matrix_rank(matrix[:2, :3]) != 2:
        raise ValueError('Degenerate camera')
    frame = (mesh.get('frame_id'), mesh.get('world_unit'))
    if None in frame or frame != (camera.get('frame_id'), camera.get('world_unit')):
        raise Blocked('frame_mismatch', 'Snapshot and reference camera must use the same frame and units')
    shape = scan.get('face_shape', {})
    segments = copy.deepcopy(shape.get('segments', []))
    size = [scan['image']['width'], scan['image']['height']]
    if not segments:
        raise Blocked('outline_missing', 'No supported face contours found')
    validate_segments(segments, size)
    evidence=outline_readiness(scan)
    missing=evidence['missing_regions'];low=evidence['low_coverage_regions']
    partial=bool(missing or low) and mode=='auto'
    supported=[r for r in REGIONS if evidence['regions'][r]['status']=='sufficient']
    if partial:
        if not {'jaw_left','jaw_right','chin'}.issubset(supported):
            raise Blocked('partial_evidence_insufficient','Visible-fragment fitting requires supported left jaw, right jaw and chin')
        segments=[s for s in segments if s['region'] in supported]
    elif missing:
        raise Blocked('outline_incomplete', 'Missing observed regions: ' + ', '.join(missing))
    reg = scan['registration']
    cx, ey, sep = (float(reg[k]) for k in ('axis_x_px', 'eye_line_y_px', 'eye_spacing_px'))
    chin = shape.get('chin_bottom', {}).get('point_px')
    if not chin or not np.isfinite([cx, ey, sep, *chin]).all() or sep <= 0 or chin[1] <= ey:
        raise Blocked('anchors_missing', 'Eye registration and a supported chin boundary are required')
    # A few isolated points must not count as a measured entire jaw/cheek.
    if low and not partial:
        raise Blocked('outline_coverage_low', 'Insufficient visible span for ' + ', '.join(evidence['low_coverage_regions']))
    tolerance = float(config.get('target_p95_px', max(1.5, sep * .015)))
    camera_limit = float(config.get('camera_rms_limit_px', max(2, sep * .02)))
    rms = camera.get('rms_px')
    if rms is None or not np.isfinite(rms) or rms > camera_limit:
        raise Blocked('camera_error', 'Camera reprojection error exceeds the configured limit or is unknown')
    fraction = float(config.get('max_move_eye_fraction', .10))
    iterations = config.get('iterations', 24)
    if not np.isfinite([tolerance, camera_limit, fraction]).all() or tolerance <= 0 or camera_limit <= 0 or not 0 < fraction <= .25:
        raise ValueError('Invalid autopilot tolerances')
    if type(iterations) is not int or not 1 <= iterations <= 100:
        raise ValueError('Iterations must be an integer in 1..100')
    vertices = np.asarray(mesh['vertices'], float)
    xy = project(vertices, camera)
    if vertices.ndim != 2 or vertices.shape[1] != 3 or not np.isfinite(xy).all():
        raise ValueError('Invalid mesh projection')
    inverse = np.linalg.pinv(matrix[:2, :3])
    height = chin[1] - ey
    t = (xy[:, 1] - ey) / height
    lateral = (xy[:, 0] - cx) / sep
    # Compact, C1-smooth bands; upper face and central nose/mouth stay fixed.
    def smooth(a, b, values):
        u = np.clip((values-a)/(b-a), 0, 1)
        return u*u*(3-2*u)
    controls = []
    amplitude = sep * fraction
    mutable={side:[] for side in ('left','right')}
    if partial:
        # Separate fragments retain separate tapered support. No control crosses
        # a missing row, and vertical/chin controls are disabled in this mode.
        for s in segments:
            if s['region']=='chin':continue
            side=s['region'].rsplit('_',1)[1]
            ys=[p[1] for p in s['points_px']];mutable[side].append([min(ys),max(ys)])
        support={}
        for side in ('left','right'):
            weight=np.zeros(len(vertices))
            for lo,hi in mutable[side]:
                taper=max(2.,sep*.035)
                weight=np.maximum(weight,smooth(lo,lo+taper,xy[:,1])*(1-smooth(hi-taper,hi,xy[:,1])))
            support[side]=weight
    layout=config.get('control_layout','local' if partial else 'regional')
    if layout not in ('local','regional') or (layout=='local' and not partial):
        raise ValueError('control_layout local requires visible-fragment mode; use regional')
    interpolated={side:[] for side in ('left','right')}
    if layout=='local':
        bridge=float(config.get('bridge_gap_px',max(2*max(2.,sep*.035),sep*.06)))
        if not np.isfinite(bridge) or bridge<0:raise ValueError('bridge_gap_px must be a non-negative number')
        mutable,interpolated=bridge_gaps(mutable,bridge)
        controls,amplitude=local_controls(vertices,mesh["triangles"],camera,size,segments,mutable,inverse,cx,sep,fraction,smooth)
    for side, sign in ([] if layout=='local' else [('left', -1), ('right', 1)]):
        side_weight = smooth(.25, .60, sign*lateral)
        for name, center in [('cheek', .30), ('jaw', .65), ('chin_corner', .93)]:
            if partial and (name=='chin_corner' or name+'_'+side not in supported):continue
            band = np.maximum(0, 1-abs(t-center)/.40)
            weight = band*band*(3-2*band)*side_weight*smooth(0, .12, t)
            if partial:weight *= support[side]
            offsets = (weight*amplitude*sign)[:, None]*inverse[:, 0]
            controls.append({'name': name+'_'+side, 'min': -1, 'max': 1, 'offsets': offsets.tolist()})
    if not partial:
        weight = smooth(.70, .98, t)*(1-smooth(.45, 1, abs(lateral)))
        controls.append({'name': 'chin_height', 'min': -1, 'max': 1,
                         'offsets': ((weight*amplitude)[:, None]*inverse[:, 1]).tolist()})
    if layout=='local':
        # Overlapping bands combine; bound by their joint reach at the limits.
        max_move=float(np.linalg.norm(np.abs(np.asarray([c['offsets'] for c in controls])).sum(axis=0),axis=1).max())
    else:
        max_move = amplitude * float(np.linalg.norm(inverse, ord=2))
    pins = snapshot.get('protected_vertices', [])
    if any(type(p) is not int or not 0 <= p < len(vertices) for p in pins):
        raise ValueError('Invalid protected vertices')
    source_pins=list(pins)
    effective = np.asarray([c['offsets'] for c in controls])
    if partial:
        pins=sorted(set(pins)|set(np.flatnonzero(~np.any(effective!=0,axis=(0,2))).tolist()))
        # Fade toward explicit constraints as well as observation boundaries.
        # Hard-pinned vertices stay exact, without a one-vertex movement step.
        # Local bands already taper at observation boundaries; fading again
        # toward those no-support vertices would attenuate twice.
        fade=source_pins if layout=='local' else pins
        if fade:
            from scipy.spatial import cKDTree
            distance=cKDTree(vertices[fade]).query(vertices)[0]
            feather=max(2.,sep*.035)*float(np.linalg.norm(inverse,ord=2))
            effective *= smooth(0,feather,distance)[None,:,None]
        for control,offsets in zip(controls,effective):control['offsets']=offsets.tolist()
    effective[:, pins, :] = 0
    control_support=[{'name':control['name'],
        'movable_vertices':int(np.any(abs(offsets)>1e-12,axis=1).sum()),
        'max_projected_motion_px_per_unit':float(np.linalg.norm(offsets@matrix[:2,:3].T,axis=1).max())}
        for control,offsets in zip(controls,effective)]
    if np.max(np.linalg.norm(effective, axis=2)) < 1e-12:
        raise Blocked('constraints_lock_face', 'Protected vertices lock all available face-outline controls')
    job = {'mesh': copy.deepcopy(mesh), 'controls': controls, 'control_support':control_support,'protected_vertices': list(pins),
           'views': [{'name': 'face_outline', 'target_kind': 'visible_outline', 'segments': segments,
                      'source_sha256': scan['source_sha256'], 'camera': camera, 'size': size}],
            'max_displacement': max_move, 'iterations': iterations, 'initial_step': .5,
           'regularization': .00001, 'per_view_regression_tolerance': 0,
           'coverage':{'mode':'visible_fragments' if partial else 'full','requested_mode':mode,
                       'supported_regions':supported,'unresolved_regions':missing+low,
                       'source_protected_vertices':len(source_pins),'frozen_vertices':len(pins),
                       'interpolated_gaps_px':interpolated,
                       'interpolation_scope':'Unobserved rows between nearby fragments may move smoothly with their neighbours; they are never measured or scored.'}}
    if partial:job['views'][0]['mutable_outline_intervals_px']=mutable
    if layout=='local':
        # The change of edge position may grow by at most 1 px per row: a moved
        # edge then meets a still one without a visible notch.
        job['views'][0]['max_edge_shear_px_per_row']=float(config.get('max_edge_shear_px_per_row',1.))
    return job, tolerance


def run(snapshot, scan, camera, out, config=None):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=False)
    report = {'schema': 'polpal.face-autopilot/1', 'status': 'running',
              'source_sha256': scan.get('source_sha256'), 'events': [],
              'source_mesh_sha256':snapshot.get('mesh',{}).get('sha256'),
              'scope': 'Observed face outline only; fixed orthographic camera, existing isolated mesh. Not full character generation.',
              'automatic_blender_import': False, 'likeness_approved': False}
    write(out/'autopilot-report.json', report)
    result=None
    try:
        report['input_evidence']=outline_readiness(scan)
        job, tolerance = prepare_job(snapshot, scan, camera, config)
        report['coverage']=job['coverage'];partial=job['coverage']['mode']=='visible_fragments'
        report['control_support']=job['control_support']
        report['events'].append({'stage': 'prepare', 'status': 'complete', 'controls': len(job['controls'])})
        write(out/'fit-job.json', job)
        view = job['views'][0]
        before_mask = render_silhouette(np.asarray(job['mesh']['vertices']), np.asarray(job['mesh']['triangles']), camera, view['size'])
        before = measure_outline(before_mask, view['segments'])
        source_pins=snapshot.get('protected_vertices',[])
        report['control_reach']=control_reach(job,source_pins,before_mask,before)
        report['control_reach']['overlay']=str(reach_overlay(job,source_pins,before_mask,out/'control-reach.png').name)
        write(out/'autopilot-report.json', report)
        result = fit_mesh(job, out/'fit')
        verify_result(job, result)
        after_mask = render_silhouette(np.asarray(result['vertices']), np.asarray(result['triangles']), camera, view['size'])
        after = measure_outline(after_mask, view['segments'])
        # Independent final gates: average objective improvement cannot hide a
        # p95 regression in a jaw region, or qualify an incomplete face outline.
        gates = {r: {'before': before[r], 'after': after[r],
                     'within_target': after[r]['p95_px'] <= tolerance,
                     'no_regression': after[r]['p95_px'] <= before[r]['p95_px'] + 1e-9
                                      and after[r]['mean_px'] <= before[r]['mean_px'] + 1e-9}
                 for r in job['coverage']['supported_regions']}
        no_regression = all(g['no_regression'] for g in gates.values())
        supported_target_met = no_regression and all(g['within_target'] for g in gates.values())
        target_met = supported_target_met and not partial
        status = 'target_met' if target_met else ('partial_candidate' if partial else 'candidate') if no_regression and result['accepted_steps'] else 'stalled' if no_regression else 'rejected'
        if partial:
            stability=frozen_outline_error(before_mask,after_mask,view['mutable_outline_intervals_px'])
            if any(g['max_error_px']>0 for g in stability.values()):raise ValueError('Unobserved outline changed')
            report['frozen_outline']=stability
            if 'max_edge_shear_px_per_row' in view:
                report['edge_shear']={'max_px_per_row':edge_shear(before_mask,after_mask),'limit_px_per_row':view['max_edge_shear_px_per_row']}
        for r in job['coverage']['unresolved_regions']:
            gates[r]={'status':'unknown','reason':report['input_evidence']['regions'][r]['status']}
        report.update(status=status, target_p95_px=tolerance, regions=gates,
                      full_target_met=target_met,supported_target_met=supported_target_met,
                      accepted_steps=result['accepted_steps'], job_sha256=job_digest(job),
                      source_mesh_sha256=job['mesh']['sha256'],
                      result='fit/fit-result.json', job='fit-job.json',
                      import_recommended=status in ('target_met', 'candidate','partial_candidate'),
                       stop_reason='regional_target_met' if target_met else 'regional_regression' if not no_regression else result['search_diagnostics']['stop_reason'],
                      protection={'vertices': len(job['protected_vertices']), 'source_vertices':len(snapshot.get('protected_vertices',[])), 'preserved': True})
        report['events'] += [{'stage': 'optimize', 'status': 'complete'}, {'stage': 'regional_validation', 'status': status}]
    except Blocked as error:
        report.update(status='blocked', stop_reason=error.code, message=str(error), import_recommended=False)
    except Exception as error:
        report.update(status='failed', message=str(error), import_recommended=False)
        report['diagnosis']=diagnose(report,camera=camera,result=result)
        write(out/'diagnosis.json',report['diagnosis'])
        write(out/'autopilot-report.json', report)
        raise
    report['diagnosis']=diagnose(report,camera=camera,result=result)
    write(out/'diagnosis.json',report['diagnosis'])
    write(out/'autopilot-report.json', report)
    return report
