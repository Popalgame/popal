"""Revisioned local annotation projects and integrated measurement actions."""
import base64
import copy
import hashlib
import io
import json
import math
from pathlib import Path
import re
import shutil
import uuid

import numpy as np
from PIL import Image,ImageDraw

from metrology3d import fit_camera,reconstruct
from deviation import compare_masks,heatmap,align_similarity

LANDMARKS=['iris_center_left','iris_center_right','eye_inner_left','eye_outer_left','eye_inner_right','eye_outer_right',
           'nose_tip','nose_base','upper_lip','mouth_left','mouth_right','chin_bottom','jaw_left','jaw_right',
           'ear_top_left','ear_bottom_left','ear_top_right','ear_bottom_right']
MASKS=['eye_left','eye_right','sclera_left','sclera_right','iris_left','iris_right','pupil_left','pupil_right',
       'brow_left','brow_right','lash_left','lash_right','nose','mouth','ear_left','ear_right','skin','hair','face_surface']


def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def safe_path(root,value):
    root=Path(root).resolve();path=(root/value).resolve()
    if not path.is_relative_to(root):raise ValueError('Path outside project')
    return path


def write_json(path,value):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    text=json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False)+'\n'
    temp=path.with_name(path.name+'.'+uuid.uuid4().hex+'.tmp');temp.write_text(text);temp.replace(path)


def read(root):
    p=json.loads((Path(root)/'project.json').read_text())
    if p.get('schema')!='polpal.scan-studio/2':raise ValueError('Unsupported studio project')
    return p


def commit(root,p,expected=None):
    root=Path(root)
    if expected is not None and read(root)['revision']!=expected:raise ValueError('Revision conflict; reload the project')
    p['revision']+=1
    history=root/'revisions'/f"{p['revision']:06}.json"
    if history.exists():raise ValueError('Revision already exists')
    write_json(history,p);write_json(root/'project.json',p);return p


def create(root,name='Aiko / Scan Studio'):
    root=Path(root)
    if root.exists():raise FileExistsError(root)
    root.mkdir(parents=True)
    p={'schema':'polpal.scan-studio/2','name':name,'revision':0,'views':{},'results':{},
       'landmark_names':LANDMARKS,'mask_names':MASKS,'notes':'All imported automatic evidence remains candidate; no 100% accuracy claim.'}
    return commit(root,p)


def import_view(root,view_id,image,report_path=None,label=None):
    if not re.fullmatch(r'[a-z0-9_-]{1,40}',view_id):raise ValueError('Invalid view identifier')
    root=Path(root);p=read(root)
    if view_id in p['views']:raise ValueError('View already exists')
    folder=root/'views'/view_id
    image=Path(image);destination=folder/'source.png';rgba=Image.open(image).convert('RGBA')
    report=json.loads(Path(report_path).read_text()) if report_path else {}
    if report and report['source_sha256']!=digest(image):raise ValueError('Scan/source mismatch')
    folder.mkdir(parents=True);shutil.copy2(image,destination) if image.suffix.lower()=='.png' else rgba.save(destination)
    w,h=rgba.size;roi=report.get('roi_px',[0,0,w,h]);cal=report.get('ocular_metrology',{}).get('calibration',{})
    v={'id':view_id,'label':label or view_id,'image':str(destination.relative_to(root)),'source_sha256':digest(destination),
       'original_source_sha256':digest(image),'width':w,'height':h,'roi':roi,'masks':{},'proposals':{},'landmarks':{},
       'calibration':{'mm_per_px':cal.get('mm_per_px'),'origin_px':cal.get('origin_px',[0,0]),'scale_relative_uncertainty':cal.get('scale_relative_uncertainty')},
       'outline':[],'camera':None,'camera_config':{'kind':'orthographic','world_unit':'mm','frame_id':'aiko-model'},'results':{},
       'base_hints':{k:val for k,val in report.get('input_hints',{}).items() if k not in ('feature_masks','face_outline','side_profile')},'semantic_roi':[max(0,roi[0]-70),max(0,roi[1]-100),min(w,roi[2]+70),min(h,roi[3]+30)]}
    if report:
        for name in MASKS:
            source=Path(report_path).parent/'masks'/(name+'.png')
            if source.exists():
                target=folder/(name+'.png');shutil.copy2(source,target)
                v['masks'][name]={'path':str(target.relative_to(root)),'sha256':digest(target),'status':report['features'].get(name,{}).get('status','candidate'),
                                  'origin':'scanner proposal','active':False,'reviewed':False}
        for side in ('left','right'):
            f=report['features']['iris_'+side]
            if f.get('centroid_px'):v['landmarks']['iris_center_'+side]={'point_px':f['centroid_px'],'sigma_px':2,'visible':True,'origin':'mask centroid candidate'}
        tip=report.get('face_shape',{}).get('chin_bottom',{}).get('point_px')
        if tip:v['landmarks']['chin_bottom']={'point_px':tip,'sigma_px':3,'visible':True,'origin':'contrast boundary candidate'}
    p['views'][view_id]=v;return commit(root,p,p['revision'])


def validate_view(root,v):
    if digest(safe_path(root,v['image']))!=v['source_sha256']:raise ValueError('Source image changed; reimport required')
    for entry in list(v['masks'].values())+list(v.get('proposals',{}).values()):
        if digest(safe_path(root,entry['path']))!=entry['sha256']:raise ValueError('Annotation mask changed outside revision history')


def validate_landmarks(landmarks,v):
    if not isinstance(landmarks,dict) or set(landmarks)-set(LANDMARKS):raise ValueError('Unknown landmark name')
    for item in landmarks.values():
        xy=np.asarray(item['point_px'],float)
        if xy.shape!=(2,) or not np.isfinite(xy).all() or not (0<=xy[0]<v['width'] and 0<=xy[1]<v['height']):raise ValueError('Landmark outside image')
        sigma=item.get('sigma_px',1)
        if not isinstance(sigma,(int,float)) or not math.isfinite(sigma) or sigma<=0:raise ValueError('Invalid landmark sigma')
        if item.get('point3d') is not None:
            point=np.asarray(item['point3d'],float)
            if point.shape!=(3,) or not np.isfinite(point).all():raise ValueError('Invalid model-space point')


def landmark_measurements(v):
    output={};landmarks=v['landmarks'];scale=v['calibration'].get('mm_per_px')
    for name,a,b,axis in (('nose_base_upper_lip','nose_base','upper_lip',1),('inner_eye_spacing','eye_inner_left','eye_inner_right',0),
                          ('mouth_width','mouth_left','mouth_right',0),('lip_chin_height','upper_lip','chin_bottom',1)):
        if a not in landmarks or b not in landmarks or not all(landmarks[k].get('visible',True) for k in (a,b)):
            output[name]={'status':'unknown'};continue
        value=landmarks[b]['point_px'][axis]-landmarks[a]['point_px'][axis]
        sigma=math.hypot(landmarks[a]['sigma_px'],landmarks[b]['sigma_px'])
        item={'status':'candidate','signed_distance_px':value,'conditional_sigma_px':sigma,'definition':a+' -> '+b}
        if scale:item['signed_distance_mm']=value*scale;item['conditional_sigma_mm']=sigma*scale
        output[name]=item
    return output


def scan_view(root,v,run):
    """Shared scanner stage for interactive use and deterministic automation."""
    from face_scan import scan_face,save_scan
    hints=copy.deepcopy(v['base_hints']);hints.pop('calibration',None);hints.pop('feature_masks',None)
    hints['roi']=v['roi'];annotations={}
    eligible=set(MASKS)-{'skin','hair','face_surface'}
    for name,item in v['masks'].items():
        if item.get('active') and name in eligible:
            annotations[name]={'path':str(safe_path(root,item['path'])),'source_sha256':v['source_sha256'],'status':'partial'}
            if name.startswith('ear_'):hints.setdefault('regions',{})[name]=[0,0,v['width'],v['height']]
    if annotations:hints['feature_masks']=annotations
    if all('iris_center_'+s in v['landmarks'] for s in ('left','right')):
        hints['eye_centers_px']=[v['landmarks']['iris_center_'+s]['point_px'] for s in ('left','right')]
    if v['outline']:hints['face_outline']={'source_sha256':v['source_sha256'],'segments':v['outline']}
    cal=v['calibration'] if v['calibration'].get('mm_per_px') else None
    result,masks,rgb=scan_face(safe_path(root,v['image']),hints=hints,calibration=cal)
    result['anatomical_landmarks']={'points':v['landmarks'],'measurements':landmark_measurements(v)}
    save_scan(result,masks,rgb,run)
    v['results'].update(scan=str((run/'face-scan.json').relative_to(root)),shape_overlay=str((run/'face-shape-overlay.png').relative_to(root)),
                       layout_overlay=str((run/'facial-layout-overlay.png').relative_to(root)),stale_analysis=False)
    return result


def resolve_camera(v):
    if v.get('camera') is not None:return v['camera']
    points=[(name,item) for name,item in v['landmarks'].items() if item.get('point3d') is not None and item.get('visible',True)]
    config=v['camera_config']
    camera=fit_camera([i['point3d'] for _,i in points],[i['point_px'] for _,i in points],kind=config['kind'],
        sigma_px=[i['sigma_px'] for _,i in points],intrinsics=config.get('K'),world_unit=config.get('world_unit','mm'),frame_id=config.get('frame_id','model'))
    camera['source_sha256']=v['source_sha256'];camera['landmark_names']=[name for name,_ in points]
    v['camera']=camera
    return camera


def action(root,payload,model_path=None):
    root=Path(root);p=read(root);expected=payload.get('revision')
    if expected!=p['revision']:raise ValueError('Revision conflict; reload the project')
    kind=payload['action'];view_id=payload.get('view');v=p['views'].get(view_id)
    if v:validate_view(root,v)
    run_id=uuid.uuid4().hex[:12];run=root/'runs'/run_id
    if kind=='restore':
        revision=payload.get('restore_revision')
        if type(revision) is not int or not 1<=revision<=p['revision']:raise ValueError('Invalid historical revision')
        restored=json.loads((root/'revisions'/f'{revision:06}.json').read_text())
        for old_view in restored['views'].values():validate_view(root,old_view)
        restored['revision']=p['revision'];restored['restored_from_revision']=revision;p=restored
    elif kind=='save':
        if not v:raise ValueError('Select a view')
        if 'landmarks' in payload:
            validate_landmarks(payload['landmarks'],v)
            if payload['landmarks']!=v['landmarks']:
                v['camera']=None;v['results'].pop('camera_overlay',None)
            v['landmarks']=payload['landmarks']
        if 'roi' in payload:
            box=payload['roi']
            if len(box)!=4 or any(type(n) is not int for n in box) or not (0<=box[0]<box[2]<=v['width'] and 0<=box[1]<box[3]<=v['height']):raise ValueError('Invalid face ROI')
            v['roi']=box
            v['semantic_roi']=[max(0,box[0]-70),max(0,box[1]-100),min(v['width'],box[2]+70),min(v['height'],box[3]+30)]
        if 'calibration' in payload:
            cal=payload['calibration'];s=cal.get('mm_per_px')
            if s is not None and (not isinstance(s,(int,float)) or not math.isfinite(s) or s<=0):raise ValueError('Invalid scale')
            origin=cal.get('origin_px',[0,0])
            if len(origin)!=2 or not (0<=origin[0]<v['width'] and 0<=origin[1]<v['height']):raise ValueError('Invalid scale origin')
            u=cal.get('scale_relative_uncertainty')
            if u is not None and (not isinstance(u,(int,float)) or not math.isfinite(u) or u<0):raise ValueError('Invalid scale uncertainty')
            v['calibration']=cal
        if 'outline' in payload:
            from face_shape import annotation_segments
            valid=np.asarray(Image.open(safe_path(root,v['image'])).convert('RGBA'))[:,:,3]>127
            if payload['outline']:
                annotation_segments({'source_sha256':v['source_sha256'],'segments':payload['outline']},
                    {'source_sha256':v['source_sha256'],'image':{'width':v['width'],'height':v['height']},'registration':{'eye_spacing_px':max(8,(v['roi'][2]-v['roi'][0])/2.5)}},valid)
            v['outline']=payload['outline']
        if payload.get('mask_png'):
            name=payload['mask_name']
            if name not in MASKS:raise ValueError('Unknown mask')
            data=base64.b64decode(payload['mask_png'].split(',')[-1],validate=True)
            image=Image.open(io.BytesIO(data)).convert('RGBA')
            if image.size!=(v['width'],v['height']):raise ValueError('Wrong mask dimensions')
            a=np.asarray(image);mask=(a[:,:,:3].max(2)>127)&(a[:,:,3]>127)
            valid=np.asarray(Image.open(safe_path(root,v['image'])).convert('RGBA'))[:,:,3]>127
            if (mask&~valid).any():raise ValueError('Mask contains transparent source pixels')
            target=root/'edits'/(run_id+'.png');target.parent.mkdir(exist_ok=True)
            Image.fromarray(mask.astype(np.uint8)*255).save(target)
            v['masks'][name]={'path':str(target.relative_to(root)),'sha256':digest(target),'status':'partial',
                              'active':True,'reviewed':False,'origin':'interactive annotation; semantic correctness requires review'}
        v['results']['landmark_measurements']=landmark_measurements(v)
        v['results']['stale_analysis']=True
        p['results']['annotations_changed_at_revision']=expected+1
    elif kind=='semantic':
        from semantic_scan import infer
        if not model_path:raise ValueError('Configure a local ONNX model at server start')
        report=infer(safe_path(root,v['image']),model_path,v['semantic_roi'],run)
        v['proposals']={name:{**item,'path':str(Path(item['path']).relative_to(root.resolve())),
                             'sha256':digest(item['path']),'active':False} for name,item in report['proposals'].items()}
        v['results']['semantic']=str((run/'semantic.json').relative_to(root));v['results']['semantic_overlay']=str((run/'overlay.png').relative_to(root))
        v['results']['entropy']=str((run/'entropy.png').relative_to(root))
    elif kind=='use_proposal':
        name=payload['mask_name'];entry=copy.deepcopy(v['proposals'][name]);entry['active']=True
        entry['status']='partial';entry['origin']='selected AI proposal; not anatomically verified';v['masks'][name]=entry
        v['results']['stale_analysis']=True
    elif kind=='scan':
        if not v:raise ValueError('Select a view')
        scan_view(root,v,run)
    elif kind=='camera':
        config=payload.get('config',v['camera_config']);points=[(name,item) for name,item in v['landmarks'].items() if item.get('point3d') is not None and item.get('visible',True)]
        c=fit_camera([i['point3d'] for _,i in points],[i['point_px'] for _,i in points],kind=config['kind'],
                     sigma_px=[i['sigma_px'] for _,i in points],intrinsics=config.get('K'),world_unit=config.get('world_unit','mm'),frame_id=config.get('frame_id','model'))
        c['source_sha256']=v['source_sha256'];c['landmark_names']=[name for name,_ in points]
        v['camera']=c;v['camera_config']=config;run.mkdir(parents=True)
        im=Image.open(safe_path(root,v['image'])).convert('RGB');draw=ImageDraw.Draw(im)
        for (_,item),prediction in zip(points,c['reprojection_px']):
            x,y=prediction;draw.line([tuple(item['point_px']),tuple(prediction)],fill='#ff6644',width=2);draw.ellipse((x-3,y-3,x+3,y+3),outline='#8af08b',width=2)
        im.save(run/'camera-overlay.png');v['results']['camera_overlay']=str((run/'camera-overlay.png').relative_to(root))
    elif kind=='reconstruct':
        for view in p['views'].values():validate_view(root,view)
        result=reconstruct(list(p['views'].values()));result['source_revision']=expected;run.mkdir(parents=True);write_json(run/'multiview.json',result)
        p['results']['multiview']=str((run/'multiview.json').relative_to(root));p['results']['multiview_summary']=result
    elif kind=='compare':
        import cv2
        a=p['views'][payload['reference']];b=p['views'][payload['candidate']]
        validate_view(root,a);validate_view(root,b)
        names=[n for n in a['landmarks'] if n in b['landmarks'] and a['landmarks'][n].get('visible',True) and b['landmarks'][n].get('visible',True)]
        alignment=align_similarity([b['landmarks'][n]['point_px'] for n in names],[a['landmarks'][n]['point_px'] for n in names])
        matrix=np.asarray(alignment['matrix']);run.mkdir(parents=True)
        fields={};rgb=np.asarray(Image.open(safe_path(root,a['image'])).convert('RGB'))
        coverage=cv2.warpAffine(np.ones((b['height'],b['width']),np.uint8),matrix,(a['width'],a['height']),flags=cv2.INTER_NEAREST)>0
        alpha_a=np.asarray(Image.open(safe_path(root,a['image'])).convert('RGBA'))[:,:,3]>127
        alpha_b=np.asarray(Image.open(safe_path(root,b['image'])).convert('RGBA'))[:,:,3]>127
        coverage &= alpha_a & (cv2.warpAffine(alpha_b.astype(np.uint8),matrix,(a['width'],a['height']),flags=cv2.INTER_NEAREST)>0)
        for name in a['masks'].keys()&b['masks'].keys():
            ra=np.asarray(Image.open(safe_path(root,a['masks'][name]['path'])))>127
            cb=np.asarray(Image.open(safe_path(root,b['masks'][name]['path'])))
            warped=cv2.warpAffine(cb,matrix,(a['width'],a['height']),flags=cv2.INTER_NEAREST)>127
            metrics,error=compare_masks(ra,warped,coverage,mm_per_px=a['calibration'].get('mm_per_px'),
                segmentation_sigma_px=payload.get('segmentation_sigma_px'),camera_sigma_px=payload.get('camera_sigma_px'),
                scale_relative_sigma=a['calibration'].get('scale_relative_uncertainty'))
            heatmap(rgb,error,run/(name+'-error.png'));metrics['heatmap']=str((run/(name+'-error.png')).relative_to(root))
            metrics['reference_mask_origin']=a['masks'][name]['origin'];metrics['candidate_mask_origin']=b['masks'][name]['origin'];fields[name]=metrics
        result={'alignment':alignment,'landmarks_used':names,'features':fields,'reference':a['id'],'candidate':b['id'],
                'reference_source_sha256':a['source_sha256'],'candidate_source_sha256':b['source_sha256'],'revision':expected,
                'limitations':['Silhouette/mask agreement does not establish likeness. Annotation identity and visibility must be reviewed.']}
        write_json(run/'comparison.json',result);p['results']['comparison']=str((run/'comparison.json').relative_to(root));p['results']['comparison_summary']=result
    elif kind=='autopilot_face':
        from autopilot import run as run_autopilot
        if not v:raise ValueError('Select a reference view')
        scan=scan_view(root,v,run/'scan')
        # Reuse a source-bound camera, or calibrate from the project's paired
        # observations. Never invent a camera from three frontal landmarks.
        camera=v.get('camera');camera_error=None
        if camera is None:
            try:camera=resolve_camera(v)
            except ValueError as error:camera_error=str(error)
        result=run_autopilot(payload['snapshot'],scan,camera,run/'autopilot',payload.get('config'))
        result['source_revision']=expected;result['reference_view']=view_id
        if camera_error:result['camera_diagnostic']=camera_error
        write_json(run/'autopilot/autopilot-report.json',result)
        p['results']['autopilot']=str((run/'autopilot/autopilot-report.json').relative_to(root))
        p['results']['autopilot_summary']=result
        p['results'].pop('autopilot_job',None);p['results'].pop('autopilot_result',None)
        if result.get('job'):p['results']['autopilot_job']=str((run/'autopilot'/result['job']).relative_to(root))
        if result.get('import_recommended'):p['results']['autopilot_result']=str((run/'autopilot'/result['result']).relative_to(root))
    elif kind=='fit':
        from mesh_fit import fit_mesh
        job=payload['job']
        result=fit_mesh(job,run,root=root)
        p['results']['fit']=str((run/'fit-result.json').relative_to(root));p['results']['fit_summary']={k:v for k,v in result.items() if k not in ('vertices','triangles','history')}
    else:raise ValueError('Unknown studio action')
    if kind in ('save','use_proposal','camera') and p['results'].get('autopilot_summary'):
        previous=p['results']['autopilot_summary']
        previous['previous_status']=previous.get('previous_status',previous['status'])
        previous.update(status='stale',stop_reason='inputs_changed',import_recommended=False)
        p['results'].pop('autopilot_result',None);p['results'].pop('autopilot_job',None)
    return commit(root,p,expected)
