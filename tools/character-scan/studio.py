#!/usr/bin/env python3
"""Local Scan Studio with revisioned files and an optional fixed Blender worker."""
import argparse
import base64
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import io
import json
import mimetypes
from pathlib import Path
import threading
from urllib.parse import urlparse,unquote
import uuid

from PIL import Image
import studio_project as project

DISCONNECT=(BrokenPipeError,ConnectionResetError,ConnectionAbortedError)


class Server(ThreadingHTTPServer):
    daemon_threads=True
    def __init__(self,address,root,model,blender=None):
        super().__init__(address,Handler);self.root=Path(root).resolve();self.model=model;self.lock=threading.Lock()
        from blender_pipeline import Jobs
        self.jobs=Jobs(self.root,blender)
        import engine  # local character engine, tab 05; runs live inside the project
        self.engine=engine.Engine(self.root/'engine-runs',blender)


class Handler(BaseHTTPRequestHandler):
    def log_message(self,format,*args):pass
    def respond(self,value,status=200):
        data=json.dumps(value,ensure_ascii=False,allow_nan=False).encode()
        self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)))
        self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(data)
    def fail(self,error):
        if isinstance(error,DISCONNECT):return  # client went away mid-response; nothing to answer
        status=(404 if isinstance(error,FileNotFoundError) else 409 if isinstance(error,ValueError) and 'Revision conflict' in str(error)
                else 400 if isinstance(error,ValueError) else 500)
        try:self.respond({'error':str(error)},status)
        except DISCONNECT:pass
    def local_request(self):
        host=self.headers.get('Host','');allowed={f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}'}
        if host not in allowed:raise ValueError('Local host required')
        origin=self.headers.get('Origin')
        if origin and origin not in {'http://'+v for v in allowed}:raise ValueError('Same-origin requests only')
    def do_GET(self):
        try:
            self.local_request();path=unquote(urlparse(self.path).path)
            if path=='/engine':
                self.send_response(301);self.send_header('Location','/engine/');self.send_header('Content-Length','0');self.end_headers();return
            if path.startswith('/engine/'):
                import engine;return engine.route_get(self,self.server.engine,path[len('/engine'):])
            if path=='/api/project':
                p=project.read(self.server.root);p['runtime']={'semantic_available':bool(self.server.model),'local_only':True};return self.respond(p)
            if path=='/api/pipeline':return self.respond({'enabled':bool(self.server.jobs.blender),'jobs':self.server.jobs.states()})
            if path.startswith('/asset/'):
                file=project.safe_path(self.server.root,path[len('/asset/'):])
            else:
                file=project.safe_path(Path(__file__).parent/'studio-web','index.html' if path=='/' else path.lstrip('/'))
            if not file.is_file():return self.respond({'error':'Not found'},404)
            data=file.read_bytes();self.send_response(200);self.send_header('Content-Type',mimetypes.guess_type(str(file))[0] or 'application/octet-stream')
            self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-cache');self.send_header('X-Content-Type-Options','nosniff')
            self.end_headers();self.wfile.write(data)
        except Exception as error:self.fail(error)
    def do_POST(self):
        try:
            self.local_request()
            if urlparse(self.path).path.startswith('/engine/'):
                import engine;return engine.route_post(self,self.server.engine,urlparse(self.path).path[len('/engine'):])
            if urlparse(self.path).path!='/api/action':return self.respond({'error':'Not found'},404)
            if self.headers.get('Content-Type','').split(';')[0]!='application/json':raise ValueError('JSON required')
            length=int(self.headers.get('Content-Length',0))
            if not 0<length<=32*1024*1024:raise ValueError('Request size outside limit')
            payload=json.loads(self.rfile.read(length))
            with self.server.lock:
                if payload.get('action')=='blender_pipeline':return self.respond(self.server.jobs.start(payload),202)
                if payload.get('action')=='cancel_pipeline':
                    return self.respond({'status':'cancellation_requested' if self.server.jobs.cancel() else 'no_active_job'})
                if payload.get('action')=='add_view':
                    if project.read(self.server.root)['revision']!=payload.get('revision'):raise ValueError('Revision conflict')
                    image=Image.open(io.BytesIO(base64.b64decode(payload['image'].split(',')[-1],validate=True)))
                    if image.width*image.height>32_000_000:raise ValueError('Image too large')
                    folder=self.server.root/'uploads';folder.mkdir(exist_ok=True);path=folder/(uuid.uuid4().hex+'.png')
                    try:image.save(path);result=project.import_view(self.server.root,payload['id'],path,label=payload.get('label'))
                    except BaseException:path.unlink(missing_ok=True);raise  # a rejected upload is never referenced
                else:result=project.action(self.server.root,payload,self.server.model)
            result['runtime']={'semantic_available':bool(self.server.model),'local_only':True};self.respond(result)
        except Exception as error:self.fail(error)


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);sub=p.add_subparsers(dest='command',required=True)
    for name in ('init','add-view'):
        s=sub.add_parser(name);s.add_argument('--project',type=Path,required=True);s.add_argument('--image',type=Path,required=True)
        s.add_argument('--report',type=Path);s.add_argument('--id',default='front');s.add_argument('--label',default='Reference / front')
    s=sub.add_parser('serve');s.add_argument('--project',type=Path,required=True);s.add_argument('--model',type=Path);s.add_argument('--port',type=int,default=8765)
    s.add_argument('--blender',type=Path,help='Local Blender executable for isolated pipeline jobs')
    s=sub.add_parser('bind-blender',help='Bind an immutable static face source once')
    s.add_argument('--project',type=Path,required=True);s.add_argument('--blend',type=Path,required=True)
    s.add_argument('--object',required=True);s.add_argument('--frame-id',required=True)
    s.add_argument('--protection',type=Path,help='Source-bound protected vertex manifest JSON, merged with SCAN_PROTECT')
    s=sub.add_parser('blender-pipeline',help='Snapshot, scan, fit, import and validate Blender renders')
    s.add_argument('--project',type=Path,required=True);s.add_argument('--blender',type=Path,required=True);s.add_argument('--view',default='front')
    s.add_argument('--coverage-mode',choices=('auto','full'),default='auto')
    s=sub.add_parser('autopilot-face',help='Scan, prepare controls, fit and validate visible face contours')
    s.add_argument('--project',type=Path,required=True);s.add_argument('--snapshot',type=Path,required=True)
    s.add_argument('--view',default='front');s.add_argument('--iterations',type=int,default=24)
    s.add_argument('--target-p95-px',type=float)
    a=p.parse_args()
    if a.command in ('init','add-view'):
        if a.command=='init':project.create(a.project)
        result=project.import_view(a.project,a.id,a.image,a.report,a.label);print(a.project/'project.json')
    elif a.command=='bind-blender':
        from blender_pipeline import bind
        print(json.dumps(bind(a.project,a.blend,a.object,a.frame_id,a.protection)['blender_source'],indent=2))
    elif a.command=='blender-pipeline':
        from blender_pipeline import Jobs
        result=Jobs(a.project,a.blender).start({'revision':project.read(a.project)['revision'],'view':a.view,'config':{'coverage_mode':a.coverage_mode}},background=False)
        print(json.dumps(result,ensure_ascii=False,indent=2));raise SystemExit(0 if result['status']=='target_met' else 2)
    elif a.command=='autopilot-face':
        current=project.read(a.project);config={'iterations':a.iterations}
        if a.target_p95_px is not None:config['target_p95_px']=a.target_p95_px
        result=project.action(a.project,{'action':'autopilot_face','revision':current['revision'],'view':a.view,
            'snapshot':json.loads(a.snapshot.read_text()),'config':config})
        report=result['results']['autopilot_summary'];print(json.dumps(report,ensure_ascii=False,indent=2))
        raise SystemExit(0 if report['status']=='target_met' else 2)
    else:
        project.read(a.project)
        if a.model and not a.model.is_file():p.error('Model not found')
        server=Server(('127.0.0.1',a.port),a.project,a.model,a.blender);print(f'Scan Studio: http://127.0.0.1:{server.server_port}',flush=True)
        server.serve_forever()
