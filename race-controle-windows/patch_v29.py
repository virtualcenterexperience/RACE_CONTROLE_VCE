"""VCE 2.9 · verified AC channels & 15-second live sample bridge."""
from pathlib import Path
import ast
root=Path("agent")
def rep(file, old, new):
 p=root/file
 src=p.read_text(encoding="utf-8")
 hits=src.count(old)
 if hits!=1:raise RuntimeError(f"{file}: patch anchor not unique ({hits}): {old[:80]}")
 p.write_text(src.replace(old,new,1),encoding="utf-8")

rep("release_updates.py","VERSION='2.8.0'","VERSION='2.9.0'")

# These channels have defined offsets in AC's shared-memory physics/graphics structs.
# We deliberately leave world XY absent until their offsets are verified on both games.
rep("core.py",
"""    gear: Optional[int]=None
    lap_time_ms: Optional[int]=None""",
"""    gear: Optional[int]=None
    rpm: Optional[int]=None
    fuel_l: Optional[float]=None
    position: Optional[int]=None
    sector_index: Optional[int]=None
    lap_time_ms: Optional[int]=None""")
rep("core.py",
"fields=('lap_pos','speed_kmh','brake','throttle','steer','gear','lap_time_ms','world_x','world_z')",
"fields=('lap_pos','speed_kmh','brake','throttle','steer','gear','rpm','fuel_l','position','sector_index','lap_time_ms','world_x','world_z')")
rep("core.py",
"self.track='';self.car='';self.state='idle'",
"self.track='';self.car='';self.session_type='';self.state='idle'")
rep("core.py",
"self.track=frame.track or self.track;self.car=frame.car or self.car",
"self.track=frame.track or self.track;self.car=frame.car or self.car;self.session_type=frame.session_type or self.session_type")
rep("core.py",
"'car':self.car,'started_at':self.started,'ended_at':time.time()",
"'car':self.car,'session_type':self.session_type,'started_at':self.started,'ended_at':time.time()")

rep("adapters.py",
"gear=ph.gear,lap_time_ms=lap_time,last_lap_ms=last,",
"""gear=ph.gear,rpm=int(ph.rpms) if 0<=ph.rpms<=30000 else None,
             fuel_l=as_number(ph.fuel,2) if 0<=ph.fuel<=1000 else None,
             position=int(gr.position) if 0<=gr.position<=1000 else None,
             sector_index=int(gr.currentSectorIndex) if 0<=gr.currentSectorIndex<=50 else None,
             lap_time_ms=lap_time,last_lap_ms=last,""")

rep("client.py",
"'laps_count':session.get('laps_count'), 'best_lap_ms':session.get('best_lap_ms')},",
"'laps_count':session.get('laps_count'), 'best_lap_ms':session.get('best_lap_ms'), 'session_type':session.get('session_type')},")
rep("client.py",
"'laps_count':session.get('laps_count',0),'best_lap_ms':session.get('best_lap_ms')},'status':status})",
"'laps_count':session.get('laps_count',0),'best_lap_ms':session.get('best_lap_ms'), 'session_type':session.get('session_type'), 'live_sample':session.get('live_sample')},'status':status})")

rep("engine.py",
"""summary={'session_id':active.session_id,'game':active.game,'track':active.track,'car':active.car,
                             'started_at':active.started,'ended_at':None,'laps_count':len(active.laps),
                             'best_lap_ms':min((l['lap_time_ms'] for l in active.laps if l.get('lap_time_ms')),default=None)}""",
"""summary={'session_id':active.session_id,'game':active.game,'track':active.track,'car':active.car,
                             'session_type':getattr(active,'session_type',''),
                             'started_at':active.started,'ended_at':None,'laps_count':len(active.laps),
                             'best_lap_ms':min((l['lap_time_ms'] for l in active.laps if l.get('lap_time_ms')),default=None)}
                    with self.guard:
                        summary['live_sample']=dict(active.samples[-1]) if active.samples else None""")

for p in root.glob("*.py"):
 ast.parse(p.read_text(encoding="utf-8"),filename=str(p))
print("VCE v2.9: channels, live sample, session metadata patched and syntax validated")
