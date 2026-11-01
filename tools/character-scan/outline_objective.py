"""Visible face-edge objectives; missing regions are never zero-error samples."""
import numpy as np

REGIONS = ('cheek_left', 'cheek_right', 'jaw_left', 'jaw_right', 'chin')


def frozen_outline_error(before,after,mutable_intervals):
    """Source-relative edge stability outside observed rows; not a reference accuracy score."""
    if before.shape!=after.shape:raise ValueError('Silhouette dimensions differ')
    height,width=before.shape;rows=np.arange(height);result={}
    occupied_before=before.any(axis=1);occupied_after=after.any(axis=1)
    for side in ('left','right'):
        frozen=np.ones(height,bool)
        for lo,hi in mutable_intervals[side]:frozen &= ~((rows>=lo)&(rows<=hi))
        relevant=frozen & (occupied_before|occupied_after)
        a=before if side=='left' else before[:,::-1]
        b=after if side=='left' else after[:,::-1]
        distance=np.abs(a.argmax(axis=1)-b.argmax(axis=1))
        distance[occupied_before!=occupied_after]=width
        result[side]={'checked_rows':int(relevant.sum()),'max_error_px':float(distance[relevant].max()) if relevant.any() else 0.}
    return result


def edge_shear(before, after):
    """Largest row-to-row change of edge displacement, per side, in px/row.

    A moved edge next to a still one forms a step in the silhouette. This is
    a smoothness check of the change, not a reference accuracy score.
    """
    if before.shape != after.shape:
        raise ValueError('Silhouette dimensions differ')
    width = before.shape[1]
    both = before.any(axis=1) & after.any(axis=1)
    result = {}
    for side in ('left', 'right'):
        a = before if side == 'left' else before[:, ::-1]
        b = after if side == 'left' else after[:, ::-1]
        change = (b.argmax(axis=1)-a.argmax(axis=1)).astype(float)
        steps = [abs(change[i+1]-change[i]) for i in range(len(change)-1) if both[i] and both[i+1]]
        result[side] = float(max(steps, default=0.))
    return result


def validate_segments(segments, size):
    width, height = size
    if not segments:
        raise ValueError('No visible outline segments')
    for segment in segments:
        if segment.get('region') not in REGIONS or segment.get('status') not in ('partial', 'candidate'):
            raise ValueError('Invalid visible outline region/status')
        points = np.asarray(segment['points_px'], float)
        if points.ndim != 2 or points.shape[1] != 2 or len(points) < 3 or not np.isfinite(points).all():
            raise ValueError('Invalid outline points')
        if np.any(points < 0) or np.any(points >= [width, height]):
            raise ValueError('Outline outside reference image')


def measure_outline(mask, segments):
    """Compare corresponding scanline edges, without completing occluded curves.

    Input must be an isolated face silhouette. A hair silhouette or the union
    of the character's parts is not an anatomical face contour.
    """
    errors = {}
    h, w = mask.shape
    for segment in segments:
        region = segment['region']
        points = np.asarray(segment['points_px'], float)
        scan_axis = 0 if region == 'chin' else 1
        # A dense tracing must not outweigh a sparse tracing of the same edge.
        bins = np.rint(points[:, scan_axis]).astype(int)
        for index in np.unique(bins):
            observed = float(np.mean(points[bins == index, 1 - scan_axis]))
            line = mask[:, index] if scan_axis == 0 else mask[index, :]
            occupied = np.flatnonzero(line)
            if not len(occupied):
                error = float(max(w, h))
            else:
                predicted = float(occupied[0] - .5 if region.endswith('_left') else occupied[-1] + .5)
                error = abs(predicted - observed)
            errors.setdefault(region, []).append(error)
    return {region: {'samples': len(values), 'mean_px': float(np.mean(values)),
                     'p95_px': float(np.percentile(values, 95)), 'max_px': float(np.max(values))}
            for region, values in errors.items()}
