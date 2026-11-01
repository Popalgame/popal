import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch

from PIL import Image

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import studio_project as project
import blender_pipeline
from blender_pipeline import Jobs


class DurabilityTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)/'project';project.create(self.root)
        self.image=Path(self.temp.name)/'image.png';Image.new('RGBA',(32,40),'white').save(self.image)

    def test_crash_between_history_and_project_write_does_not_block_commits(self):
        p=project.read(self.root);n=p['revision']
        real=project.write_json
        def crash(path,value):
            if Path(path).name=='project.json':raise OSError('simulated crash')
            real(path,value)
        with patch.object(project,'write_json',side_effect=crash):
            with self.assertRaises(OSError):project.commit(self.root,project.read(self.root),n)
        self.assertTrue((self.root/'revisions'/f'{n+1:06}.json').exists());self.assertEqual(project.read(self.root)['revision'],n)
        p=project.read(self.root);p['notes']='after crash';p=project.commit(self.root,p,n)
        self.assertEqual(p['revision'],n+1)
        self.assertEqual(json.loads((self.root/'revisions'/f'{n+1:06}.json').read_text())['notes'],'after crash')
        self.assertEqual(len(list((self.root/'revisions').glob(f'{n+1:06}.json.orphan-*'))),1)

    def test_published_history_is_still_immutable(self):
        p=project.read(self.root);stale=dict(p,revision=p['revision']-1)
        with self.assertRaisesRegex(ValueError,'already exists'):project.commit(self.root,stale)

    def test_commit_waits_for_cross_process_lock(self):
        held=project.lock(self.root/'.studio.lock');done=threading.Event()
        p=project.read(self.root)
        thread=threading.Thread(target=lambda:(project.commit(self.root,p,p['revision']),done.set()));thread.start()
        try:self.assertFalse(done.wait(.3))
        finally:held.close()
        thread.join(5);self.assertTrue(done.is_set())
        with project.lock(self.root/'x.lock'):
            with self.assertRaises(BlockingIOError):project.lock(self.root/'x.lock',wait=False)

    def test_failed_import_leaves_no_folder_and_identifier_reusable(self):
        with patch.object(project,'commit',side_effect=ValueError('Revision conflict; reload the project')):
            with self.assertRaises(ValueError):project.import_view(self.root,'front',self.image)
        self.assertEqual(list((self.root/'views').iterdir()),[])
        (self.root/'views'/'front').mkdir();(self.root/'views'/'front'/'stale.png').write_bytes(b'orphan')
        p=project.import_view(self.root,'front',self.image)
        self.assertEqual(p['views']['front']['image'],'views/front/source.png')
        self.assertFalse((self.root/'views'/'front'/'stale.png').exists());project.validate_view(self.root,p['views']['front'])
        self.assertEqual([x.name for x in (self.root/'views').iterdir()],['front'])

    def test_corrupt_job_state_is_flagged_not_fatal(self):
        jobs=Jobs(self.root,None)
        good=jobs.folder/'good';good.mkdir();project.write_json(good/'state.json',{'status':'running','source_revision':1})
        bad=jobs.folder/'bad';bad.mkdir();(bad/'state.json').write_text('{truncated')
        jobs=Jobs(self.root,None)  # restart recovery must survive the corrupt record
        states={s.get('id','good'):s for s in jobs.states()}
        self.assertEqual(states['bad']['status'],'unreadable');self.assertEqual(states['good']['status'],'interrupted')

    def test_cancel_applies_only_to_an_active_job(self):
        jobs=Jobs(self.root,'/unused/blender')
        self.assertFalse(jobs.cancel());self.assertFalse(jobs.cancel_event.is_set())
        jobs.active=True;self.assertTrue(jobs.cancel());self.assertTrue(jobs.cancel_event.is_set())

    def test_cancel_during_fit_is_honoured_when_fit_returns(self):
        from test_autopilot import fixture
        snapshot,scan,camera=fixture();project.import_view(self.root,'front',self.image);p=project.read(self.root)
        blend=Path(self.temp.name)/'source.blend';blend.write_bytes(b'fixture');p=blender_pipeline.bind(self.root,blend,'face','fixture')
        camera['source_sha256']=scan['source_sha256']=p['views']['front']['source_sha256'];p['views']['front']['camera']=camera
        project.commit(self.root,p,p['revision']);jobs=Jobs(self.root,'/unused/blender')
        def worker(stage,blend,out):project.write_json(out/'snapshot.json',snapshot)
        def fit(*args):
            self.assertTrue(jobs.cancel());return {'status':'target_met','import_recommended':True}
        with patch.object(jobs,'worker',side_effect=worker) as called,patch.object(project,'scan_view',return_value=scan),patch('blender_pipeline.fit',side_effect=fit):
            state=jobs.start({'revision':project.read(self.root)['revision'],'view':'front'},background=False)
        self.assertEqual(state['status'],'cancelled');self.assertEqual(called.call_count,1);self.assertFalse(jobs.active)
        jobs.lease().close()

    def test_studio_imports_without_fcntl(self):
        import builtins,importlib
        real=builtins.__import__
        def no_fcntl(name,*args,**kwargs):
            if name=='fcntl':raise ImportError(name)
            return real(name,*args,**kwargs)
        with patch('builtins.__import__',side_effect=no_fcntl):
            importlib.reload(blender_pipeline)
            handle=project.lock(self.root/'y.lock');handle.close()  # degrades (or uses msvcrt) instead of failing
        importlib.reload(blender_pipeline)


class HttpErrorTests(unittest.TestCase):
    def setUp(self):
        from studio import Server
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)/'project';project.create(self.root)
        self.server=Server(('127.0.0.1',0),self.root,None);thread=threading.Thread(target=self.server.serve_forever,daemon=True);thread.start()
        self.addCleanup(lambda:(self.server.shutdown(),self.server.server_close(),thread.join()))
        self.base=f'http://127.0.0.1:{self.server.server_port}'

    def status(self,path):
        try:
            with urllib.request.urlopen(self.base+path) as response:return response.status
        except urllib.error.HTTPError as error:
            error.close();return error.code

    def test_missing_files_are_404_and_bad_paths_400(self):
        self.assertEqual(self.status('/asset/missing.png'),404)
        self.assertEqual(self.status('/asset/../../outside'),400)
        (self.root/'project.json').rename(self.root/'moved.json')
        self.assertEqual(self.status('/api/project'),404)

    def test_client_disconnect_is_swallowed(self):
        from studio import Handler
        handler=Handler.__new__(Handler)
        with patch.object(Handler,'respond',side_effect=BrokenPipeError) as respond:
            handler.fail(BrokenPipeError());respond.assert_not_called()
            handler.fail(ValueError('x'));respond.assert_called_once()

    def test_rejected_upload_is_removed(self):
        import base64,io
        buf=io.BytesIO();Image.new('RGBA',(8,8),'white').save(buf,format='PNG')
        body=json.dumps({'action':'add_view','id':'Bad ID','revision':project.read(self.root)['revision'],
                         'image':base64.b64encode(buf.getvalue()).decode()}).encode()
        request=urllib.request.Request(self.base+'/api/action',body,{'Content-Type':'application/json'})
        with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(request)
        error.exception.close();self.assertEqual(error.exception.code,400)
        self.assertEqual(list((self.root/'uploads').iterdir()),[])


if __name__=='__main__':unittest.main()
