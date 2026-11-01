"""Durable local snapshot → fit → Blender render jobs, isolated from the live scene."""
import copy
import fcntl
import importlib.util
import json
from pathlib import Path
import subprocess
import threading
import time
import uuid

import numpy as np
from PIL import Image

import studio_project as project
from autopilot import run as fit, Blocked, outline_readiness
from outline_objective import REGIONS, measure_outline, frozen_outline_error
from mesh_snapshot import protection_vertices
from fit_diagnosis import diagnose

TERMINAL={'target_met','candidate','partial_candidate','blocked','stalled','rejected','failed','cancelled','interrupted','stale'}


def bridge_permission():
    path=Path(__file__).with_name('studio_bridge.py')
    if not path.exists():path=Path(__file__).resolve().parents[1]/'blender-mcp/bridge_client.py'
    spec=importlib.util.spec_from_file_location('studio_bridge',path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    status=module.BridgeClient().call('ping')
    if status.get('python_enabled') is not True:
        raise Blocked('python_disabled','Enable Python in Blender AI Bridge before running Studio jobs')
    return status


def bind(root, blend, object_name, frame_id, protection=None):
    blend=Path(blend).expanduser().resolve()
    if blend.suffix.lower()!='.blend' or not blend.is_file():raise ValueError('Existing .blend required')
    if not object_name or not frame_id:raise ValueError('Object and frame are required')
    p=project.read(root)
    binding={'blend':str(blend),'sha256':project.digest(blend),'object':object_name,
             'frame_id':frame_id,'semantic_role':'isolated_face'}
    previous=p.get('blender_source',{}).get('protection')
    if protection is not None:binding['protection']=json.loads(Path(protection).read_text())
    elif previous:binding['protection']=copy.deepcopy(previous)
    protection_vertices(binding)
    p['blender_source']=binding
    return project.commit(root,p,p['revision'])


def validate_renders(out, report):
    """Measure independently rendered alpha; allow one pixel of raster convention noise."""
    out=Path(out);job=json.loads((out/'autopilot/fit-job.json').read_text());view=job['views'][0]
    measured={};agreement={};masks={}
    coverage=job.get('coverage',{'mode':'full','supported_regions':list(REGIONS),'unresolved_regions':[]})
    partial=coverage['mode']=='visible_fragments'
    for label in ('before','after'):
        image=Image.open(out/f'{label}-silhouette.png').convert('RGBA')
        if list(image.size)!=view['size']:raise ValueError('Unexpected Blender render dimensions')
        mask=np.asarray(image)[:,:,3]>127
        masks[label]=mask
        if not mask.any():raise ValueError('Empty Blender silhouette')
        predicted=np.asarray(Image.open(out/f'autopilot/fit/{label}-view-0.png').convert('L'))>127
        # Compare edges, not IoU (a large shape can conceal several pixels of edge error).
        from scipy.ndimage import binary_erosion, distance_transform_edt
        edge=mask & ~binary_erosion(mask);other=predicted & ~binary_erosion(predicted)
        distances=np.r_[distance_transform_edt(~edge)[other],distance_transform_edt(~other)[edge]]
        agreement[label]={'p95_px':float(np.percentile(distances,95)),'max_px':float(distances.max())}
        measured[label]=measure_outline(mask,view['segments'])
    regions={r:{'before':measured['before'][r],'after':measured['after'][r],
                'no_regression':all(measured['after'][r][k]<=measured['before'][r][k]+1 for k in ('mean_px','p95_px')),
                'within_target':measured['after'][r]['p95_px']<=report['target_p95_px']} for r in coverage['supported_regions']}
    agrees=all(v['p95_px']<=1.5 and v['max_px']<=3 for v in agreement.values())
    passed=agrees and all(r['no_regression'] for r in regions.values())
    stability=frozen_outline_error(masks['before'],masks['after'],view['mutable_outline_intervals_px']) if partial else None
    if stability:passed=passed and all(g['max_error_px']<=1 for g in stability.values())
    supported_target=passed and all(r['within_target'] for r in regions.values())
    status='rejected' if not passed else 'partial_candidate' if partial else 'target_met' if supported_target else 'candidate'
    for r in coverage['unresolved_regions']:regions[r]={'status':'unknown','reason':'unresolved reference coverage'}
    result={'status':status,'regions':regions,'raster_agreement':agreement,'raster_agreement_passed':agrees,
            'coverage':coverage,'full_target_met':supported_target and not partial,'supported_target_met':supported_target,'frozen_outline':stability,
            'regression_allowance_px':1,'likeness_approved':False,
            'context_render_scope':'Matched source materials/lighting for inspection; no automatic material-likeness score.'}
    project.write_json(out/'render-validation.json',result)
    return result


class Jobs:
    def __init__(self, root, blender):
        self.root=Path(root).resolve();self.blender=str(Path(blender).expanduser().resolve()) if blender else None
        self.folder=self.root/'pipeline';self.folder.mkdir(exist_ok=True)
        self.guard=threading.Lock();self.cancel_event=threading.Event();self.thread=None
        # A restart must not mistake an unfinished job for a verified candidate.
        try:lease=self.lease()
        except ValueError:return
        try:
            for path in self.folder.glob('*/state.json'):
                value=json.loads(path.read_text())
                if value['status'] not in TERMINAL:
                    value.update(status='interrupted',message='Runner stopped; artifacts retained. Start a new immutable run.')
                    project.write_json(path,value)
        finally:lease.close()

    def lease(self):
        handle=(self.folder/'runner.lock').open('a+')
        try:fcntl.flock(handle,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:
            handle.close();raise ValueError('A Blender pipeline is already running for this project')
        return handle

    def states(self):
        revision=project.read(self.root)['revision'];values=[]
        for path in sorted(self.folder.glob('*/state.json'),key=lambda p:p.stat().st_mtime,reverse=True):
            value=json.loads(path.read_text());value['current']=value['source_revision']==revision
            if not value['current']:value.pop('candidate',None)
            values.append(value)
        return values

    def start(self, payload, background=True):
        with self.guard:
            payload=copy.deepcopy(payload);payload['config']={'coverage_mode':'auto',**payload.get('config',{})}
            if not self.blender:raise ValueError('Start Studio with --blender to enable the worker')
            p=project.read(self.root)
            if p['revision']!=payload.get('revision'):raise ValueError('Revision conflict; reload the project')
            if not p.get('blender_source'):raise ValueError('Bind a static face source with bind-blender first')
            if payload.get('view') not in p['views']:raise ValueError('Select a reference view')
            lease=self.lease();self.cancel_event=threading.Event()
            try:
                out=self.folder/uuid.uuid4().hex[:12];out.mkdir()
                state={'id':out.name,'schema':'polpal.blender-pipeline/1','status':'queued','stage':'queued',
                       'source_revision':p['revision'],'reference_view':payload['view'],'events':[],
                       'report':str((out/'state.json').relative_to(self.root)),'likeness_approved':False}
                project.write_json(out/'state.json',state);project.write_json(out/'project-input.json',p)
                project.write_json(out/'request.json',{'binding':p['blender_source'],'config':payload.get('config',{})})
                args=(out,copy.deepcopy(p),copy.deepcopy(payload),state,lease)
                if background:
                    self.thread=threading.Thread(target=self.run,args=args,daemon=True);self.thread.start()
                else:self.run(*args)
                return json.loads((out/'state.json').read_text())
            except BaseException:
                lease.close();raise

    def cancel(self):
        if self.thread and self.thread.is_alive():self.cancel_event.set()

    def check_cancel(self):
        if self.cancel_event.is_set():raise InterruptedError('Cancelled; partial artifacts retained')

    def worker(self, stage, blend, out):
        self.check_cancel();bridge_permission()
        script=Path(__file__).with_name('blender_pipeline_worker.py').resolve()
        command=[self.blender,'--background','--factory-startup','--disable-autoexec',str(blend),
                 '--python-exit-code','1','--python',str(script),'--',stage,str(out/'request.json')]
        with (out/(stage+'.log')).open('w') as log:
            process=subprocess.Popen(command,stdout=log,stderr=subprocess.STDOUT)
            deadline=time.monotonic()+1800
            try:
                while True:
                    self.check_cancel()
                    if time.monotonic()>deadline:raise TimeoutError('Blender stage timed out; process terminated')
                    try:code=process.wait(timeout=.25);break
                    except subprocess.TimeoutExpired:pass
                if code:raise RuntimeError(f'Blender {stage} failed ({code}); see {stage}.log')
            finally:
                if process.poll() is None:
                    process.terminate()
                    try:process.wait(timeout=5)
                    except subprocess.TimeoutExpired:process.kill();process.wait()

    def run(self, out, p, payload, state, lease):
        evidence=None;camera=None;validation=None
        def stage(name):
            self.check_cancel();state.update(status='running',stage=name)
            state['events'].append({'stage':name,'time':time.time()});project.write_json(out/'state.json',state)
        try:
            binding=p['blender_source'];source=Path(binding['blend']);v=p['views'][payload['view']]
            stage('preflight');project.validate_view(self.root,v)
            if project.digest(source)!=binding['sha256']:raise Blocked('source_changed','Bound .blend changed; bind the new revision first')
            stage('snapshot');self.worker('snapshot',source,out)
            snapshot=json.loads((out/'snapshot.json').read_text())
            state['source_mesh_sha256']=snapshot['mesh']['sha256']
            required=protection_vertices(binding,snapshot['mesh'])
            if not set(required).issubset(snapshot['protected_vertices']):raise ValueError('Worker omitted required protected vertices')
            state['protection_summary']={'vertices':len(snapshot['protected_vertices']),'manifest_vertices':len(required)}
            stage('scan');scan=project.scan_view(self.root,v,out/'scan')
            evidence=outline_readiness(scan);project.write_json(out/'reference-evidence.json',evidence)
            state['reference_evidence']=str((out/'reference-evidence.json').relative_to(self.root))
            state['shape_overlay']=str((out/'scan/face-shape-overlay.png').relative_to(self.root))
            if (out/'scan/boundary-evidence.json').exists():
                state['boundary_evidence']=str((out/'scan/boundary-evidence.json').relative_to(self.root))
                state['boundary_overlay']=str((out/'scan/boundary-evidence-overlay.png').relative_to(self.root))
            state['evidence_summary']={k:evidence[k] for k in ('status','missing_regions','low_coverage_regions')}
            if not v.get('camera'):
                stage('automatic_camera')
                from automatic_camera import align,overlay
                model=json.loads((out/'model-landmarks.json').read_text())
                if model.get('source_mesh_sha256')!=snapshot['mesh']['sha256'] or model.get('source_blend_sha256')!=binding['sha256']:
                    raise ValueError('Model landmark source identity mismatch')
                report=align(v,scan,model,snapshot['mesh']['sha256'])
                project.write_json(out/'automatic-camera.json',report)
                overlay(project.safe_path(self.root,v['image']),report,out/'camera-overlay.png')
                state['automatic_camera']=str((out/'automatic-camera.json').relative_to(self.root))
                state['camera_overlay']=str((out/'camera-overlay.png').relative_to(self.root))
                camera=report.get('camera',{})
                state['camera_summary']={k:camera[k] for k in ('method','rms_px','observations','rotation_estimated_from_reference') if k in camera}
                if report['status']!='candidate':raise Blocked('camera_required',report.get('message','Automatic camera observations are inconsistent'))
                v['camera']=report['camera']
            project.write_json(out/'camera.json',v['camera'])
            camera=v['camera']
            if (v['camera'].get('frame_id'),v['camera'].get('world_unit'))!=(binding['frame_id'],'mm'):
                raise Blocked('frame_mismatch','Camera and Blender binding must share a millimetre world frame')
            stage('fit')
            report=fit(snapshot,scan,v['camera'],out/'autopilot',payload.get('config'))
            state['fit_report']=str((out/'autopilot/autopilot-report.json').relative_to(self.root))
            state['fit_status']=report['status']
            state['coverage']=report.get('coverage')
            if report.get('coverage',{}).get('mode')=='visible_fragments':
                state['message']='Visible fragments only; unresolved regions stay unknown and their vertices remain frozen.'
            if not report.get('import_recommended'):
                state.update(status=report['status'],message=report.get('message',report.get('stop_reason')),stop_reason=report.get('stop_reason'));return
            stage('import_render');self.worker('render',out/'input.blend',out)
            stage('reopen');self.worker('verify',out/'candidate.blend',out)
            stage('render_validation');validation=validate_renders(out,report)
            project.validate_view(self.root,v)
            state.update(status=validation['status'],render_validation=str((out/'render-validation.json').relative_to(self.root)),
                         images=[str((out/name).relative_to(self.root)) for name in
                                 ('before-silhouette.png','after-silhouette.png','before-context.png','after-context.png')])
            if project.read(self.root)['revision']!=p['revision'] or project.digest(source)!=binding['sha256']:
                state.update(status='stale',message='Inputs changed during execution; candidate not published')
            elif state['status'] in ('target_met','candidate','partial_candidate'):
                state.update(candidate=str((out/'candidate.blend').relative_to(self.root)),
                             candidate_sha256=project.digest(out/'candidate.blend'))
        except Blocked as error:state.update(status='blocked',message=str(error),stop_reason=error.code)
        except InterruptedError as error:state.update(status='cancelled',message=str(error))
        except Exception as error:state.update(status='failed',message=str(error))
        finally:
            try:
                fit_report_path=out/'autopilot/autopilot-report.json';result_path=out/'autopilot/fit/fit-result.json'
                fit_report=json.loads(fit_report_path.read_text()) if fit_report_path.exists() else {}
                result=json.loads(result_path.read_text()) if result_path.exists() else None
                diagnosis=diagnose({'source_sha256':p['views'][payload['view']]['source_sha256'],
                    'source_mesh_sha256':state.get('source_mesh_sha256'),
                    **fit_report,**(validation or {}),'status':state['status'],
                    'stop_reason':state.get('stop_reason',fit_report.get('stop_reason')),
                    'message':state.get('message',fit_report.get('message'))},evidence,camera,result)
                project.write_json(out/'diagnosis.json',diagnosis)
                state['diagnosis']=str((out/'diagnosis.json').relative_to(self.root))
                state['diagnosis_summary']=diagnosis['summary']
            except Exception as error:
                state.update(status='failed',diagnosis_error=str(error));state.pop('candidate',None);state.pop('candidate_sha256',None)
            finally:
                state['finished_at']=time.time()
                try:project.write_json(out/'state.json',state)
                finally:lease.close()
