"""Standard-library mesh identity and strict result verification for Blender import."""
import hashlib
import json
import math


def canonical(value):
    # JSON roundtrips through JavaScript erase 1.0 versus 1; identity must not.
    if isinstance(value,float) and math.isfinite(value) and value.is_integer():return int(value)
    if isinstance(value,list):return [canonical(v) for v in value]
    if isinstance(value,dict):return {k:canonical(v) for k,v in value.items()}
    return value


def mesh_digest(vertices,triangles):
    return job_digest({'vertices':vertices,'triangles':triangles})


def job_digest(job):
    return hashlib.sha256(json.dumps(canonical(job),sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest()


def protection_vertices(binding,mesh=None):
    """A portable protection manifest is bound to both file and exact world-space mesh."""
    policy=binding.get('protection')
    if policy is None:return []
    if not isinstance(policy,dict) or policy.get('schema')!='polpal.mesh-protection/1':
        raise ValueError('Invalid mesh protection manifest')
    for key,expected in [('source_blend_sha256',binding['sha256']),('object',binding['object']),('frame_id',binding['frame_id'])]:
        if policy.get(key)!=expected:raise ValueError('Protection source mismatch: '+key)
    digest=policy.get('source_mesh_sha256','')
    if not isinstance(digest,str) or len(digest)!=64 or any(c not in '0123456789abcdef' for c in digest):
        raise ValueError('Protection needs a source mesh checksum')
    pins=policy.get('protected_vertices')
    if not isinstance(pins,list) or not pins or any(type(i) is not int or i<0 for i in pins) or len(set(pins))!=len(pins):
        raise ValueError('Invalid protection vertex indices')
    if mesh is not None:
        if digest!=mesh['sha256'] or mesh.get('frame_id')!=binding['frame_id']:
            raise ValueError('Protection mesh identity mismatch')
        if max(pins)>=len(mesh['vertices']):raise ValueError('Protection vertex outside mesh')
    return sorted(pins)


def verify_result(job,result):
    mesh=job['mesh'];vertices=mesh['vertices'];triangles=mesh['triangles']
    if mesh_digest(vertices,triangles)!=mesh['sha256'] or result['source_mesh_sha256']!=mesh['sha256']:raise ValueError('Source mesh identity mismatch')
    if result.get('job_sha256')!=job_digest(job):raise ValueError('Result does not belong to this exact fitting job')
    if result['triangles']!=triangles or len(result['vertices'])!=len(vertices):raise ValueError('Result topology changed')
    pins=set(job.get('protected_vertices',[]));params=result['parameters']
    if set(params)!={c['name'] for c in job['controls']}:raise ValueError('Unexpected fitted controls')
    for control in job['controls']:
        p=params[control['name']]
        if not math.isfinite(p) or not control.get('min',-1)<=p<=control.get('max',1):raise ValueError('Control outside bounds')
    limit=job.get('max_displacement',1)
    for index,(old,new) in enumerate(zip(vertices,result['vertices'])):
        if len(new)!=3 or not all(math.isfinite(v) for v in new):raise ValueError('Invalid fitted vertex')
        expected=[old[k]+(0 if index in pins else sum(params[c['name']]*c['offsets'][index][k] for c in job['controls'])) for k in range(3)]
        if max(abs(a-b) for a,b in zip(expected,new))>1e-7:raise ValueError('Result differs from bounded controls / protected vertices')
        if math.dist(old,new)>limit+1e-7:raise ValueError('Displacement limit exceeded')
    return True
