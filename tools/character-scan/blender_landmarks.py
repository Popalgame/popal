"""Read source-bound anchors; explicit semantic markers or a narrow named-base adapter."""
import math
import bpy
from mathutils import Matrix, Vector


def collect(source, frame_id):
    scene=bpy.context.scene;factor=scene.unit_settings.scale_length*1000
    camera=scene.camera
    result={'schema':'polpal.model-landmarks/1','frame_id':frame_id,'world_unit':'mm',
            'landmarks':{},'diagnostics':[],'orientation_prior':None}
    points=result['landmarks']
    # Explicit Empty markers are portable across differently named bases.
    allowed={'iris_center_left','iris_center_right','chin_bottom','nose_tip','nose_base','upper_lip',
             'mouth_left','mouth_right','eye_inner_left','eye_inner_right','eye_outer_left','eye_outer_right'}
    for name in sorted(allowed):
        matches=[o for o in scene.objects if o.type=='EMPTY' and o.get('scan_studio_landmark')==name]
        if len(matches)>1:raise ValueError('Ambiguous semantic markers: '+name)
        if matches:
            obj=matches[0];points[name]={'point3d':list(obj.matrix_world.translation*factor),
                'method':'explicit semantic marker origin','object':obj.name,'status':'candidate'}
    if camera is None or camera.data.type!='ORTHO':
        result['diagnostics'].append('No orthographic source camera; fixed-orientation prior unavailable')
        return result
    rotation=camera.matrix_world.to_quaternion().to_matrix()
    # Camera looks down local -Z; image Y points down.
    r=Matrix((rotation.col[0],-rotation.col[1],-rotation.col[2]))
    result['orientation_prior']={'R':[list(row) for row in r],'object':camera.name,
        'method':'orthographic source camera orientation; base-model assumption',
        'rotation_estimated_from_reference':False}
    aliases={'iris_center_left':'Iris L','iris_center_right':'Iris R'}
    for name,alias in aliases.items():
        if name in points:continue
        # Do not silently accept suffix copies: they can be unrelated studies.
        matches=[o for o in scene.objects if o.name==alias or o.name.startswith(alias+'.')]
        if len(matches)!=1 or matches[0].name!=alias:
            result['diagnostics'].append('Missing or ambiguous base part: '+alias);continue
        obj=matches[0]
        if obj.type!='MESH' or not len(obj.data.vertices) or obj.find_armature() or obj.constraints or obj.animation_data or obj.data.shape_keys or any(m.show_viewport or m.show_render for m in obj.modifiers):
            result['diagnostics'].append('Non-static iris part: '+alias);continue
        coords=[r@(obj.matrix_world@v.co)*factor for v in obj.data.vertices]
        center=Vector([(min(p[i] for p in coords)+max(p[i] for p in coords))/2 for i in range(3)])
        points[name]={'point3d':list(r.transposed()@center),'method':'named-base iris projected bounding-box centre',
                      'object':obj.name,'status':'candidate'}
    if not all(k in points for k in aliases):return result
    left,right=[r@Vector(points[k]['point3d']) for k in aliases]
    spacing=right.x-left.x
    if spacing<=0 or abs(right.y-left.y)>spacing*.35:
        result['diagnostics'].append('Source view is not a compatible frontal eye pair')
        result['orientation_prior']=None;return result
    if 'chin_bottom' not in points:
        cx=(left.x+right.x)/2
        central=[r@(source.matrix_world@v.co)*factor for v in source.data.vertices]
        central=[p for p in central if abs(p.x-cx)<=spacing*.1]
        if central:
            bottom=max(p.y for p in central);support=[p for p in central if p.y>=bottom-spacing*.003]
            center=sum(support,Vector())/len(support)
            distance=center.y-(left.y+right.y)/2
            if spacing*.3<=distance<=spacing*1.5:
                points['chin_bottom']={'point3d':list(r.transposed()@center),'object':source.name,
                    'method':'lowest central projected boundary of isolated face mesh','support_vertices':len(support),'status':'candidate'}
            else:result['diagnostics'].append('Central lower boundary is outside a plausible face band')
    if any(not all(math.isfinite(x) for x in p['point3d']) for p in points.values()):raise ValueError('Nonfinite model landmarks')
    return result
