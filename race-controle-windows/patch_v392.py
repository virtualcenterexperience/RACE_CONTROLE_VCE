"""VCE 3.9.2: 50Hz native sampling, background continuity and LMU timing."""
from pathlib import Path
import ast

def replace(name,old,new):
    p=Path('agent')/name;s=p.read_text(encoding='utf-8')
    if s.count(old)!=1:raise RuntimeError(f'{name}: source anchor mismatch: {old[:70]}')
    p.write_text(s.replace(old,new,1),encoding='utf-8')
replace('release_updates.py',"VERSION='3.9.1'","VERSION='3.9.2'")
replace('core.py','self.last_sample_time=0.0','self.last_sample_time=0.0\n        self.next_sample_time=None\n        self.participants=[]')
replace('core.py',"""        if frame.timestamp-self.last_sample_time < (1.0 / 120.0):return
        self.last_sample_time=frame.timestamp""", """        # Phase-locked 20ms slots, accepting only fresh native game frames.
        # No interpolation/repeated frames to conceal a paused or slower game.
        period=.02
        if self.next_sample_time is None or frame.timestamp<self.last_sample_time:
            self.next_sample_time=frame.timestamp
        if frame.timestamp+1e-6<self.next_sample_time:return
        steps=max(1,int((frame.timestamp-self.next_sample_time+1e-6)/period)+1)
        self.next_sample_time+=steps*period
        self.last_sample_time=frame.timestamp""")
replace('core.py',"'laps':self.laps}","'laps':self.laps,'participants':self.participants}")
replace('engine.py',"                    if active!=game:","""                    # Brief mapping disappearance / ALT-TAB must not end a stint.
                    if active is None and adapter is not None and now-last_live<60:
                        active=game
                    if active!=game:""")
replace('engine.py',"                            rec.feed(frame)","""                            rec.participants=getattr(adapter,'participants',[])
                            rec.feed(frame)""")
replace('engine.py',"""                        elif rec and now-last_live>12:
                            path=rec.finish();self.mark(path);self.log('Session terminée (sortie piste)');rec=None
                            with self.guard:self.record=None
                            with self.guard:self.presence_state='game_detected'
                            self.status('EN ATTENTE DE SESSION · '+game)""", """                        elif rec and now-last_live>60:
                            path=rec.finish();self.mark(path);rec=None
                            adapter.close();adapter=None;next_open=now+3
                            with self.guard:self.record=None
                            self.status('FLUX JEU INACTIF · séance sauvegardée')
                        elif rec and now-last_live>12:
                            self.status('FLUX JEU EN PAUSE · capture et transferts maintenus')""")
replace('engine.py',"'samples':batch}","'samples':batch,'participants':getattr(rec,'participants',[]) if time.monotonic()-last_standings_at>=1 else []}")
replace('engine.py','        lag_reported=False','        lag_reported=False\n        last_standings_at=0')
replace('engine.py','                cloud.live_batch(snapshot)','                cloud.live_batch(snapshot)\n                if snapshot.get(\'participants\'):last_standings_at=time.monotonic()')
replace('engine.py',"summary['live_sample']=dict(active.samples[-1]) if active.samples else None", "summary['live_sample']=dict(active.samples[-1]) if active.samples else None\n                        summary['participants']=list(getattr(active,'participants',[]))")
replace('client.py',"'live_sample':session.get('live_sample')}","'live_sample':session.get('live_sample'),'participants':session.get('participants',[])}")
replace('engine.py', 'time.sleep(.005 if game in SUPPORTED_LIVE else .5)', 'time.sleep(.01 if game in SUPPORTED_LIVE else .5)')
for file in ['core.py','engine.py','vce_lmu_native.py']:
    p=Path('agent')/file;s=p.read_text(encoding='utf-8').replace('cible 120 Hz','cible 50 Hz').replace('Target 120 Hz','Target 50 Hz').replace('échantillonnage cible 120 Hz','échantillonnage cible 50 Hz')
    p.write_text(s,encoding='utf-8')
for p in Path('agent').glob('*.py'):ast.parse(p.read_text(encoding='utf-8'),filename=str(p))
print('VCE 3.9.2 native 50Hz, background and participant sources verified')
