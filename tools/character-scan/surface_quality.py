"""Technical surface checks of a deformed mesh against its source.

Compares the same topology before and after a fit: triangle normal rotation,
new creases (dihedral change), local stretch and new self-intersections.
Defects already present in the source are not counted. This is a geometry
check only; it says nothing about likeness or the intended design.
"""
import numpy as np
from scipy.spatial import cKDTree

LIMITS = {'max_normal_rotation_deg': 25., 'max_crease_change_deg': 10.,
          'min_area_ratio': .5, 'max_area_ratio': 2., 'max_new_intersections': 0}


def _normals(vertices, triangles):
    a, b, c = (vertices[triangles[:, i]] for i in range(3))
    n = np.cross(b-a, c-a)
    area = np.linalg.norm(n, axis=1)
    return n/np.maximum(area, 1e-300)[:, None], area/2


def _interior_edges(triangles):
    """Pairs of triangles sharing an edge."""
    edges = np.sort(np.concatenate([triangles[:, [0, 1]], triangles[:, [1, 2]], triangles[:, [2, 0]]]), axis=1)
    owner = np.tile(np.arange(len(triangles)), 3)
    order = np.lexsort((edges[:, 1], edges[:, 0]))
    edges, owner = edges[order], owner[order]
    same = np.all(edges[1:] == edges[:-1], axis=1)
    return np.c_[owner[:-1][same], owner[1:][same]]


def _segment_hits(p, q, a, b, c, eps=1e-12):
    """Vectorised segment p-q versus triangle a-b-c (Moller-Trumbore), strict interior."""
    d = q-p
    e1, e2 = b-a, c-a
    h = np.cross(d, e2)
    det = np.sum(e1*h, axis=1)
    ok = np.abs(det) > eps
    inv = np.where(ok, 1/np.where(ok, det, 1), 0)
    s = p-a
    u = np.sum(s*h, axis=1)*inv
    qv = np.cross(s, e1)
    v = np.sum(d*qv, axis=1)*inv
    t = np.sum(e2*qv, axis=1)*inv
    return ok & (u > eps) & (v > eps) & (u+v < 1-eps) & (t > eps) & (t < 1-eps)


def intersecting_pairs(vertices, triangles, candidates):
    """Triangle index pairs (i<j) among candidates whose surfaces cross, excluding neighbours."""
    candidates = np.asarray(sorted(set(int(i) for i in candidates)), int)
    if len(candidates) < 2:
        return set()
    tri = vertices[triangles]
    centre = tri.mean(axis=1)
    radius = np.linalg.norm(tri-centre[:, None], axis=2).max(axis=1)
    tree = cKDTree(centre)
    reach = 2*float(radius.max())
    pairs = set()
    for i in candidates:
        for j in tree.query_ball_point(centre[i], radius[i]+reach):
            if j == i:
                continue
            key = (min(i, j), max(i, j))
            if key in pairs or np.linalg.norm(centre[i]-centre[j]) > radius[i]+radius[j]:
                continue
            if set(triangles[i].tolist()) & set(triangles[j].tolist()):
                continue
            pairs.add(key)
    if not pairs:
        return set()
    pairs = np.asarray(sorted(pairs), int)
    hit = np.zeros(len(pairs), bool)
    for first, second in ((0, 1), (1, 0)):
        x, y = tri[pairs[:, first]], tri[pairs[:, second]]
        for k in range(3):
            hit |= _segment_hits(x[:, k], x[:, (k+1) % 3], y[:, 0], y[:, 1], y[:, 2])
    return {tuple(p) for p in pairs[hit].tolist()}


def check(source, result, triangles, limits=None, source_triangles=None):
    """source_triangles: the source tessellation, when the result's differs.

    Blender may switch the diagonal of a deformed quad. Comparing normals of a
    switched pair measures the switch, not a deformation, so such triangles are
    reported separately and left out of the rotation and crease limits.
    """
    limits = {**LIMITS, **(limits or {})}
    source = np.asarray(source, float)
    result = np.asarray(result, float)
    triangles = np.asarray(triangles, int)
    switched = np.zeros(len(triangles), bool)
    if source_triangles is not None:
        source_triangles = np.asarray(source_triangles, int)
        if source_triangles.shape != triangles.shape:
            raise ValueError('Surface check needs identical topology')
        switched = np.any(np.sort(source_triangles, axis=1) != np.sort(triangles, axis=1), axis=1)
    if source.shape != result.shape:
        raise ValueError('Surface check needs identical topology')
    moved_vertex = np.linalg.norm(result-source, axis=1) > 1e-9
    moved = np.flatnonzero(moved_vertex[triangles].any(axis=1))
    n0, area0 = _normals(source, triangles)
    n1, area1 = _normals(result, triangles)
    valid = area0 > 1e-12
    rotation = np.degrees(np.arccos(np.clip(np.sum(n0*n1, axis=1), -1, 1)))
    rotation[~valid | switched] = 0
    ratio = np.where(valid, area1/np.where(valid, area0, 1), 1)
    pairs = _interior_edges(triangles)
    dihedral0 = np.degrees(np.arccos(np.clip(np.sum(n0[pairs[:, 0]]*n0[pairs[:, 1]], axis=1), -1, 1)))
    dihedral1 = np.degrees(np.arccos(np.clip(np.sum(n1[pairs[:, 0]]*n1[pairs[:, 1]], axis=1), -1, 1)))
    crease = np.abs(dihedral1-dihedral0)
    crease[~(valid[pairs[:, 0]] & valid[pairs[:, 1]]) | switched[pairs[:, 0]] | switched[pairs[:, 1]]] = 0
    near = set(moved.tolist())
    if len(moved):
        # Neighbours of moved triangles can be crossed by them.
        tri = result[triangles]
        centre = tri.mean(axis=1)
        tree = cKDTree(centre)
        span = float(np.linalg.norm(tri-centre[:, None], axis=2).max())*3
        for group in tree.query_ball_point(centre[moved], span):
            near.update(group)
    new = intersecting_pairs(result, triangles, near)-intersecting_pairs(source, triangles, near) if len(moved) else set()
    metrics = {'moved_vertices': int(moved_vertex.sum()), 'moved_triangles': int(len(moved)),
               'max_normal_rotation_deg': float(rotation.max()),
               'max_crease_change_deg': float(crease.max()) if len(crease) else 0.,
               'min_area_ratio': float(ratio.min()), 'max_area_ratio': float(ratio.max()),
               'new_intersections': len(new), 'retessellated_triangles': int(switched.sum())}
    failures = []
    if metrics['max_normal_rotation_deg'] > limits['max_normal_rotation_deg']:
        failures.append('normal_rotation')
    if metrics['max_crease_change_deg'] > limits['max_crease_change_deg']:
        failures.append('new_crease')
    if metrics['min_area_ratio'] < limits['min_area_ratio'] or metrics['max_area_ratio'] > limits['max_area_ratio']:
        failures.append('stretch')
    if metrics['new_intersections'] > limits['max_new_intersections']:
        failures.append('self_intersection')
    worst = {'normal_rotation_triangles': np.argsort(-rotation)[:5].tolist(),
             'crease_triangle_pairs': pairs[np.argsort(-crease)[:5]].tolist() if len(crease) else [],
             'intersecting_triangle_pairs': sorted(new)[:5]}
    return {'schema': 'polpal.surface-quality/1', 'status': 'fail' if failures else 'pass',
            'failures': failures, 'metrics': metrics, 'limits': limits, 'worst': worst,
            'scope': 'Technical deformation check against the source mesh; not likeness, design approval or hidden anatomy.'}
