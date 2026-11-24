"""Offline transport regression tests; no game/network access."""
import ast
import json
import pathlib
import sys
import tempfile
import threading
import types
import unittest
from unittest.mock import Mock
ROOT=pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'agent'))
from vce_transport import recent_live_batch
import client

class TransportTests(unittest.TestCase):
    def test_live_catches_up_without_changing_archive(self):
        samples=[{'t':i/120,'world_x':i,'world_z':0,'brake':i%2} for i in range(1200)]
        before=json.dumps(samples)
        batch,end=recent_live_batch(samples,0)
        self.assertEqual(end,1200)
        self.assertLessEqual(len(batch),12)
        self.assertIs(batch[-1],samples[-1])
        self.assertLessEqual(batch[-1]['t']-batch[0]['t'],.201)
        self.assertEqual(json.dumps(samples),before)
        self.assertEqual(recent_live_batch(samples,end),([],end))
        self.assertEqual(recent_live_batch([],0),([],0))

    def test_archive_every_sample_and_ack_required(self):
        cloud=client.CloudClient({'supabase_url':'https://example.supabase.co','anon_key':'a'*30,'device_id':'test','device_secret':'test'})
        samples=[{'t':i,'world_x':i,'world_z':0} for i in range(1000)]
        sent=[]
        def post(action,payload):
            self.assertEqual(action,'upload_segment')
            part=payload['lap']['samples'];self.assertLessEqual(len(part),160)
            sent.extend(part)
            return {'ok':True,'offset':payload['offset']+len(part),'complete':len(sent)==1000}
        cloud.post=post
        cloud.send_lap({'session_id':'test','game':'LMU','started_at':1},{'lap_number':1,'samples':samples})
        self.assertEqual(sent,samples)
        cloud.post=lambda *a,**k:{'ok':True,'offset':0}
        with self.assertRaises(RuntimeError):cloud.send_lap({'session_id':'test','game':'LMU','started_at':1},{'lap_number':1,'samples':samples})

    def run_worker(self,fail_first=False):
        source=ast.parse((ROOT/'agent/engine.py').read_text())
        cls=next(n for n in source.body if isinstance(n,ast.ClassDef) and n.name=='BridgeEngine')
        method=next(n for n in cls.body if isinstance(n,ast.FunctionDef) and n.name=='_sync')
        module=ast.Module(body=[ast.ClassDef(name='Worker',bases=[],keywords=[],body=[method],decorator_list=[])],type_ignores=[])
        steps=[0];sent=[]
        class Cloud:
            def __init__(self,*a):pass
            def status(self):return {'status':'approved'}
            def presence(self,*a):pass
            def session_state(self,*a):pass
            def send_lap(self,item,lap):
                sent.append(lap['lap_number'])
                if fail_first and len(sent)==1:raise RuntimeError('temporary outage')
        env={'json':json,'time':types.SimpleNamespace(monotonic=lambda:100+steps[0]*20),'CloudClient':Cloud,'save_config':Mock()}
        exec(compile(ast.fix_missing_locations(module),'engine-sync-test','exec'),env)
        w=env['Worker']()
        with tempfile.TemporaryDirectory() as folder:
            w.root=pathlib.Path(folder);(w.root/'sessions').mkdir()
            lap={'lap_number':1,'samples':[{'t':i} for i in range(20)]}
            w.record=types.SimpleNamespace(session_id='session',game='LMU',track='track',car='car',started=1,laps=[lap],samples=lap['samples'])
            w.cfg={'consent_upload':True,'supabase_url':'configured','pilot_name':'test','steam_id64':'','sync_delay_s':5}
            w.approved=True;w.sent_sessions=set();w.guard=threading.RLock();w.presence_game='LMU';w.presence_state='in_progress'
            w._identity_matches_registration=lambda:True;w.accept_pairing=lambda data:None;w.log=lambda text:None
            w.stop_flag=types.SimpleNamespace(is_set=lambda:steps[0]>=3)
            def wait(_):
                steps[0]+=1
                if steps[0]==2:
                    w.record=None
                    (w.root/'sessions/session.json').write_text(json.dumps({'session_id':'session','game':'LMU','status':'completed','laps':[lap]}))
            w.wake=types.SimpleNamespace(wait=wait,clear=lambda:None)
            w._sync()
            self.assertIn('session',w.sent_sessions)
        return sent

    def test_completed_lap_sent_while_active_without_duplicate_at_close(self):
        self.assertEqual(self.run_worker(),[1])

    def test_failed_active_upload_retried_from_local_archive(self):
        self.assertEqual(self.run_worker(fail_first=True),[1,1])

if __name__=='__main__':unittest.main()
