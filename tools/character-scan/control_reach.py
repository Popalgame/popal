"""Which vertices form each measured outline, and can any control move them?

Explains a stalled fit from the prepared job alone: user protection,
no-support freezing, attenuation and raster resolution are reported
separately. This is a reach check of the existing controls, not a claim
about the correct face shape.
"""
import numpy as np

from metrology3d import project

EDGE_RADIUS_PX = 1.5
HALF_PIXEL = .5
LOCKED_SHARE = .95


def outline_vertices(xy, mask, segments, region):
    """Vertices projecting onto the predicted edge at each measured scanline."""
    h, w = mask.shape
    chin = region == 'chin'
    found = set()
    for segment in segments:
        if segment['region'] != region:
            continue
        for index in np.unique(np.rint(np.asarray(segment['points_px'], float)[:, 0 if chin else 1]).astype(int)):
            line = mask[:, index] if chin else mask[index, :]
            occupied = np.flatnonzero(line)
            if not len(occupied):
                continue
            if chin:
                edge = (index, occupied[-1]+.5)
            else:
                edge = (occupied[0]-.5 if region.endswith('_left') else occupied[-1]+.5, index)
            near = np.hypot(xy[:, 0]-edge[0], xy[:, 1]-edge[1]) <= EDGE_RADIUS_PX
            found.update(np.flatnonzero(near).tolist())
    return np.asarray(sorted(found), int)


def control_reach(job, source_pins, mask, observed):
    """Per-region reach of the job's controls at the vertices forming that outline.

    observed: measure_outline() result for the initial mesh.
    """
    view = job['views'][0]
    camera = view['camera']
    vertices = np.asarray(job['mesh']['vertices'], float)
    xy = project(vertices, camera)
    matrix = np.asarray(camera['P'], float)
    matrix = matrix/matrix[2, 3]
    offsets = np.asarray([c['offsets'] for c in job['controls']], float)
    # Projected motion of every vertex for one unit of each control, in px.
    motion = np.linalg.norm(offsets@matrix[:2, :3].T, axis=2)
    span = np.asarray([max(abs(c.get('min', -1)), abs(c.get('max', 1))) for c in job['controls']], float)
    source = np.zeros(len(vertices), bool)
    source[np.asarray(source_pins, int)] = True
    frozen = np.zeros(len(vertices), bool)
    frozen[np.asarray(job.get('protected_vertices', []), int)] = True
    # mesh_fit zeroes the basis at every protected vertex; full-mode jobs keep raw offsets.
    motion[:, frozen] = 0
    step = float(job.get('initial_step', .5))
    regions = {}
    for region in sorted({s['region'] for s in view['segments']}):
        edge = outline_vertices(xy, mask, view['segments'], region)
        per_unit = motion[:, edge].max(axis=0) if len(edge) else np.zeros(0)
        reach = (motion[:, edge]*span[:, None]).sum(axis=0) if len(edge) else np.zeros(0)
        categories = {
            'source_protected': int(source[edge].sum()),
            'frozen_without_support': int((frozen[edge] & ~source[edge]).sum()),
            'attenuated_subpixel': int((~frozen[edge] & (reach < HALF_PIXEL)).sum()),
            'effective': int((~frozen[edge] & (reach >= HALF_PIXEL)).sum())}
        best = int(np.argmax(per_unit)) if len(edge) else None
        driver = None
        if best is not None and per_unit[best] > 0:
            driver = job['controls'][int(np.argmax(motion[:, edge[best]]))]['name']
        error = observed.get(region, {})
        max_reach = float(reach.max()) if len(edge) else 0.
        max_unit = float(per_unit.max()) if len(edge) else 0.
        regions[region] = {
            'outline_vertices': int(len(edge)), 'categories': categories,
            'locked_share': float(source[edge].mean()) if len(edge) else None,
            'driving_control': driver,
            'max_motion_px_per_unit': max_unit,
            'max_reach_px': max_reach,
            'observed_mean_px': error.get('mean_px'), 'observed_p95_px': error.get('p95_px'),
            'first_step_motion_px': max_unit*step,
            'first_step_below_raster': 0 < max_unit*step < HALF_PIXEL,
            'reach_below_error': error.get('mean_px') is not None and max_reach < error['mean_px']}
    locked = [r for r, g in regions.items() if g['outline_vertices'] and g['locked_share'] >= LOCKED_SHARE]
    uncontrolled = [r for r, g in regions.items() if g['outline_vertices'] and g['max_reach_px'] == 0 and r not in locked]
    short = [r for r, g in regions.items() if g['reach_below_error'] and r not in locked+uncontrolled]
    raster = [r for r, g in regions.items() if g['first_step_below_raster']]
    return {'schema': 'polpal.control-reach/1', 'edge_radius_px': EDGE_RADIUS_PX,
            'initial_step': step, 'regions': regions,
            'locked_by_protection': locked, 'without_control': uncontrolled,
            'reach_below_error': short, 'first_step_below_raster': raster,
            'scope': 'Reach of the prepared controls at vertices that form the measured edge of the initial silhouette; not the correct shape.'}


def overlay(job, source_pins, mask, path):
    """Image: grey silhouette, target in white, outline vertices by category."""
    from PIL import Image, ImageDraw
    view = job['views'][0]
    vertices = np.asarray(job['mesh']['vertices'], float)
    xy = project(vertices, view['camera'])
    matrix = np.asarray(view['camera']['P'], float)
    matrix = matrix/matrix[2, 3]
    offsets = np.asarray([c['offsets'] for c in job['controls']], float)
    reach = np.linalg.norm(offsets@matrix[:2, :3].T, axis=2).sum(axis=0)
    source = np.zeros(len(vertices), bool)
    source[np.asarray(source_pins, int)] = True
    frozen = np.zeros(len(vertices), bool)
    frozen[np.asarray(job.get('protected_vertices', []), int)] = True
    reach[frozen] = 0
    image = Image.fromarray(np.repeat((mask.astype(np.uint8)*70)[:, :, None], 3, axis=2))
    draw = ImageDraw.Draw(image)
    colours = [(source, (220, 60, 60)), (frozen & ~source, (70, 120, 230)),
               (~frozen & (reach < HALF_PIXEL), (240, 170, 40)), (~frozen & (reach >= HALF_PIXEL), (60, 200, 90))]
    edge = set()
    for region in {s['region'] for s in view['segments']}:
        edge.update(outline_vertices(xy, mask, view['segments'], region).tolist())
    for selected, colour in colours:
        for index in np.flatnonzero(selected):
            x, y = xy[index]
            r = 1.5 if index in edge else .4
            draw.ellipse([x-r, y-r, x+r, y+r], fill=colour if index in edge else tuple(c//2 for c in colour))
    for segment in view['segments']:
        for x, y in segment['points_px']:
            draw.point((x, y), fill=(255, 255, 255))
    image.save(path)
    return path
