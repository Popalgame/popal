"""Palette-specific ocular candidates and exact geometry of observed pixel masks.

No ellipse completion, hidden sclera or individual lash reconstruction. Pixel
cell boundaries preserve holes and disconnected fragments; physical units need
an explicit scale. Sampling limits are not segmentation confidence intervals.
"""
import math

import numpy as np
from scipy import ndimage as ndi

KINDS = ('eye', 'sclera', 'iris', 'pupil', 'lash', 'brow')
COLORS = {'eye': '#ffbf45', 'sclera': '#88aaff', 'iris': '#15e5e5',
          'pupil': '#ff6699', 'lash': '#ff8c42', 'brow': '#58ff68'}


def attached(mask, seed):
    labels, _ = ndi.label(mask)
    ids = np.unique(labels[ndi.binary_dilation(seed, iterations=2)])
    return np.isin(labels, ids[ids > 0])


def ocular_masks(rgb, valid, iris, bounds, separation, sensitivity=0, diagnostics=None):
    """Find white fragments adjacent to teal iris, central dark pupil and lashes."""
    x0, y0, x1, y1 = bounds
    crop = rgb[y0:y1, x0:x1].astype(float)
    visible = valid[y0:y1, x0:x1]
    colored = iris[y0:y1, x0:x1]
    empty = np.zeros_like(visible)
    local = {kind: empty.copy() for kind in ('eye', 'sclera', 'pupil', 'lash')}
    if colored.any():
        r, g, b = np.moveaxis(crop, -1, 0)
        lum = crop @ np.array([.2126, .7152, .0722])
        # Enclosed holes supply a SEARCH domain, not an invented iris outline.
        envelope = ndi.binary_fill_holes(ndi.binary_closing(colored, iterations=1) | colored)
        interior = ndi.binary_erosion(envelope, iterations=max(1, round(separation*.009)))
        ys, xs = np.nonzero(colored)
        cx, cy = (xs.min()+xs.max())/2, (ys.min()+ys.max())/2
        yy, xx = np.indices(visible.shape)
        central = ((xx-cx)/max(1, (xs.max()-xs.min())*.35))**2 + ((yy-cy)/max(1, (ys.max()-ys.min())*.43))**2 < 1
        # Dark central component must have contrast against the coloured iris.
        smooth_lum = ndi.gaussian_filter(lum, .7)
        surrounding = ndi.gaussian_filter(lum, max(1, (xs.max()-xs.min())*.16))
        dark = (smooth_lum < np.minimum(90, surrounding*(.72+sensitivity*.04))) & interior & central & visible
        dark = ndi.binary_opening(dark, iterations=max(1, round(separation*.018)))
        labels, count = ndi.label(dark)
        if count:
            sizes = np.bincount(labels.ravel()); sizes[0] = 0
            # Prefer the component enclosing the eye centre; otherwise largest.
            label = labels[round(cy), round(cx)] or sizes.argmax()
            pupil = labels == label
            if pupil.sum() >= max(4, colored.sum()*.012):
                local['pupil'] = pupil
        white = (lum > 65) & (np.max(crop, axis=2)-np.min(crop, axis=2) < (.15+sensitivity*.01)*np.maximum(1,np.max(crop,axis=2))) & visible
        # Highlights inside the iris are not sclera.
        white &= ~envelope
        white = ndi.binary_opening(white, iterations=max(1, round(separation*.009)))
        sclera = attached(white, envelope)
        labels, count = ndi.label(sclera)
        rejected=0
        for index in range(1, count+1):
            part=labels==index
            rows = np.flatnonzero(part.any(axis=1))
            if part[0].any() or part[-1].any() or part[:,0].any() or part[:,-1].any():
                sclera[part]=False;rejected+=1
                continue
            if len(rows) and rows.min() >= cy:
                sclera[labels==index] = False
        if diagnostics is not None:diagnostics['rejected_sclera_components']=rejected
        local['sclera'] = sclera
        # All valid pixels enclosed by the observed iris colour ring (including
        # pupil/highlights) form the aperture support, with no external dilation.
        aperture = (envelope | sclera) & visible
        if sclera.sum() >= max(4, colored.sum()*.015):
            local['eye'] = aperture
            band = ndi.binary_dilation(aperture, iterations=max(2, round(separation*.14))) & ~aperture
            lash = (lum < 65+sensitivity*5) & (r >= g*.9) & band & visible & ~envelope
            # A dark upper rim connected to the opening is a lash/liner candidate.
            lash &= yy < cy + separation*.08
            local['lash'] = attached(lash, aperture)
    result = {}
    for kind, mask in local.items():
        full = np.zeros_like(valid)
        full[y0:y1, x0:x1] = mask
        result[kind] = full
    return result


def sensitivity_summary(masks):
    samples=[]
    for mask in masks:
        y,x=np.nonzero(mask)
        if not len(x):return {'status':'unstable','reason':'A threshold variant found no feature'}
        samples.append([int(x.max()-x.min()+1),int(y.max()-y.min()+1),float(x.mean()),float(y.mean())])
    return {'status':'sampled','width_range_px':[min(p[0] for p in samples),max(p[0] for p in samples)],
            'height_range_px':[min(p[1] for p in samples),max(p[1] for p in samples)],
            'centroid_spread_px':[max(p[i] for p in samples)-min(p[i] for p in samples) for i in (2,3)],
            'meaning':'three nearby palette/contrast thresholds; sensitivity only, not an accuracy/confidence interval'}


def pixel_contours(mask):
    """Trace oriented pixel-cell edges; preserve holes and diagonal contacts.

    Pixel centres are integer coordinates. Cell corners lie at half pixels.
    Right-turn priority keeps diagonally touching components separate.
    """
    ys, xs = np.nonzero(mask)
    if not len(xs):
        return []
    x0, y0 = int(xs.min()), int(ys.min())
    m = np.pad(mask[y0:ys.max()+1, x0:xs.max()+1], 1)
    core = m[1:-1, 1:-1]
    edges = {}
    for selection, offset, direction in (
        (core & ~m[:-2, 1:-1], (0, 0), (1, 0)),
        (core & ~m[1:-1, 2:], (1, 0), (0, 1)),
        (core & ~m[2:, 1:-1], (1, 1), (-1, 0)),
        (core & ~m[1:-1, :-2], (0, 1), (0, -1))):
        for y, x in zip(*np.nonzero(selection)):
            a = (int(x)+offset[0], int(y)+offset[1])
            b = (a[0]+direction[0], a[1]+direction[1])
            edges.setdefault(a, set()).add(b)
    loops = []
    while edges:
        start = min(edges); current = start; previous = None; points = []
        while True:
            points.append(current)
            candidates = edges[current]
            if previous is None:
                end = min(candidates)
            else:
                dx, dy = current[0]-previous[0], current[1]-previous[1]
                priority = [(current[0]-dy, current[1]+dx),
                            (current[0]+dx, current[1]+dy),
                            (current[0]+dy, current[1]-dx)]
                end = next((p for p in priority if p in candidates), min(candidates))
            candidates.remove(end)
            if not candidates: del edges[current]
            previous, current = current, end
            if current == start: break
        # Lossless collinear simplification, never spline fitting through gaps.
        simplified = []
        for i, p in enumerate(points):
            a, b = points[i-1], points[(i+1) % len(points)]
            if (p[0]-a[0])*(b[1]-p[1]) != (p[1]-a[1])*(b[0]-p[0]):
                simplified.append([p[0]+x0-.5, p[1]+y0-.5])
        area = sum(a[0]*b[1]-b[0]*a[1] for a, b in zip(simplified, simplified[1:]+simplified[:1]))/2
        loops.append({'points_px': simplified, 'hole': area < 0, 'signed_area_px2': area})
    return loops


def geometry(mask):
    ys, xs = np.nonzero(mask)
    if not len(xs): return None
    xmin, xmax, ymin, ymax = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    row_runs = []
    for y in range(ymin, ymax+1):
        values = np.flatnonzero(mask[y])
        runs = [v for v in np.split(values, np.flatnonzero(np.diff(values)>1)+1) if len(v)]
        if runs: row_runs.append([y, [[int(v[0]), int(v[-1])] for v in runs]])
    contours = pixel_contours(mask)
    centroid = [float(xs.mean()), float(ys.mean())]
    covariance = np.cov(np.array([xs, ys]), bias=True) if len(xs)>1 else np.zeros((2, 2))
    eigenvalues, eigenvectors = np.linalg.eigh(covariance)
    axis = eigenvectors[:, -1]
    labels,count=ndi.label(mask)
    components=[]
    for index,sl in enumerate(ndi.find_objects(labels),1):
        if sl is None:continue
        y,x=np.nonzero(labels[sl]==index);x=x+sl[1].start;y=y+sl[0].start
        components.append({'area_px2':len(x),'width_px':int(x.max()-x.min()+1),
                           'height_px':int(y.max()-y.min()+1),
                           'centroid_px':[float(x.mean()),float(y.mean())],
                           'bbox_px':[int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)]})
    return {'width_px': xmax-xmin+1, 'height_px': ymax-ymin+1,
            'bbox_px': [xmin, ymin, xmax+1, ymax+1], 'centroid_px': centroid,
            'bbox_center_px': [(xmin+xmax)/2, (ymin+ymax)/2],
            'area_px2': len(xs), 'row_runs_px': row_runs, 'contours': contours,
            'component_count': int(count), 'components':components,
            'extent_note':'bounding extent across all fragments; component sizes listed separately',
            'principal_axis_degrees': float(math.degrees(math.atan2(axis[1], axis[0])) % 180),
            'moment_equivalent_axes_px': [float(4*math.sqrt(max(0, v))) for v in eigenvalues[::-1]],
            'axis_note': 'second-moment descriptors of visible pixels, not fitted anatomical ellipse',
            'contour_note': 'exact mask cell edges; half-pixel coordinates; holes and fragments retained'}


def calibration(value, image):
    if value is None:
        return {'status': 'uncalibrated', 'reason': 'Supply mm_per_px; pixels alone have no physical scale'}
    if not isinstance(value, dict) or set(value)-{'mm_per_px', 'origin_px', 'basis', 'scale_relative_uncertainty'}:
        raise ValueError('Invalid ocular calibration fields')
    scale = value.get('mm_per_px')
    origin = value.get('origin_px', [0, 0])
    if not isinstance(scale, (int, float)) or not math.isfinite(scale) or scale <= 0:
        raise ValueError('mm_per_px must be finite and positive')
    if (not isinstance(origin, (list, tuple)) or len(origin)!=2 or
        any(not isinstance(v, (int, float)) or not math.isfinite(v) for v in origin)):
        raise ValueError('Invalid calibration origin')
    if not (0 <= origin[0] < image['width'] and 0 <= origin[1] < image['height']):
        raise ValueError('Calibration origin outside image')
    uncertainty = value.get('scale_relative_uncertainty')
    if uncertainty is not None and (not isinstance(uncertainty, (int, float)) or not math.isfinite(uncertainty) or uncertainty < 0):
        raise ValueError('Invalid scale uncertainty')
    return {'status': 'supplied', 'mm_per_px': scale, 'origin_px': list(origin),
            'basis': value.get('basis', 'user supplied scale'),
            'scale_relative_uncertainty': uncertainty,
            'coordinates_mm': 'x right from origin; z up from origin',
            'sampling_edge_half_pixel_mm': scale*.5,
            'sampling_extent_one_pixel_mm': scale,
            'accuracy_1mm_verified': False,
            'note': 'Sampling terms only, not total error bounds. Segmentation, perspective and scale accuracy are not established.'}


def add_metrology(report, masks, scale=None):
    cal = calibration(scale, report['image'])
    report['ocular_metrology'] = {'version': '1.1', 'calibration': cal,
        'scope': 'Visible projected masks, not full eyeballs, hidden brows or individual lash filaments',
        'relations': {}}
    for side in ('left', 'right'):
        for kind in KINDS:
            name = kind+'_'+side; f = report['features'][name]
            if f['status'] == 'unknown': continue
            g = geometry(masks[name]); f['geometry_2d'] = g
            f['measurement_scope'] = 'visible fragment' if f['status']=='partial' else 'candidate visible region'
            if cal['status'] == 'supplied':
                s = cal['mm_per_px']; ox, oy = cal['origin_px']
                def point(p): return [(p[0]-ox)*s, (oy-p[1])*s]
                mm = {'width': g['width_px']*s, 'height': g['height_px']*s,
                      'area_mm2': g['area_px2']*s*s, 'centroid_xz': point(g['centroid_px']),
                      'bbox_center_xz': point(g['bbox_center_px']),
                      'contours': [{'points_xz': [point(p) for p in c['points_px']], 'hole': c['hole']} for c in g['contours']]}
                for key in ('median_thickness_px', 'max_thickness_px', 'outer_rise_px'):
                    if key in f: mm[key[:-3]] = f[key]*s
                mm['components']=[{'width':c['width_px']*s,'height':c['height_px']*s,
                                   'area_mm2':c['area_px2']*s*s,'centroid_xz':point(c['centroid_px'])}
                                  for c in g['components']]
                g['mm'] = mm
                sensitivity=f.get('threshold_sensitivity',{})
                if sensitivity.get('status')=='sampled':
                    g['threshold_sensitivity_mm']={k.replace('_px','_mm'):[v*s for v in sensitivity[k]]
                                                  for k in ('width_range_px','height_range_px','centroid_spread_px')}
        features = report['features']; eye = features['eye_'+side]
        relations = {}
        for subject, reference in (('pupil', 'iris'), ('iris', 'eye'), ('pupil', 'eye'), ('brow', 'eye'), ('lash', 'eye')):
            a, b = features[subject+'_'+side], features[reference+'_'+side]
            if 'geometry_2d' not in a or 'geometry_2d' not in b: continue
            ga, gb = a['geometry_2d'], b['geometry_2d']
            delta = [ga['centroid_px'][i]-gb['centroid_px'][i] for i in (0, 1)]
            rel = {'offset_xy_px': delta, 'distance_px': math.hypot(*delta),
                   'width_ratio': ga['width_px']/gb['width_px'], 'height_ratio': ga['height_px']/gb['height_px'],
                   'status': 'partial' if 'partial' in (a['status'], b['status']) else 'candidate'}
            if cal['status']=='supplied':
                rel['offset_xz_mm'] = [delta[0]*s, -delta[1]*s]; rel['distance_mm'] = math.hypot(*delta)*s
            relations[subject+'_to_'+reference] = rel
        report['ocular_metrology']['relations'][side] = relations
    pairs={}
    for kind in KINDS:
        a,b=[report['features'][kind+'_'+side] for side in ('left','right')]
        if 'geometry_2d' not in a or 'geometry_2d' not in b:continue
        ca,cb=a['geometry_2d']['centroid_px'],b['geometry_2d']['centroid_px']
        delta=[cb[i]-ca[i] for i in (0,1)]
        pair={'centroid_separation_px':math.hypot(*delta),'offset_xy_px':delta,
              'status':'partial' if 'partial' in (a['status'],b['status']) else 'candidate'}
        if cal['status']=='supplied':pair['centroid_separation_mm']=math.hypot(*delta)*cal['mm_per_px']
        pairs[kind]=pair
    report['ocular_metrology']['left_right']=pairs
