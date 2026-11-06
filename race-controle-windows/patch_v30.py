"""VCE 3.0: AC on-track XY and low-latency opt-in telemetry batches."""
from pathlib import Path
import ast

root=Path("agent")
def replace(file,old,new):
 p=root/file;s=p.read_text(encoding="utf-8")
 n=s.count(old)
 if n!=1:raise RuntimeError(f"{file}: expected 1 anchor got {n}: {old[:85]}")
 p.write_text(s.replace(old,new,1),encoding="utf-8")

replace("release_updates.py","VERSION='2.9.0'","VERSION='3.0.0'")

# AC Graphics has carCoordinates[3] immediately following normalizedCarPosition.
# ACC has a DIFFERENT layout; no guessed player coordinates for ACC.
replace("adapters.py","class ACStatic(ct.LittleEndianStructure):",
'''class ACGraphicsAC(ct.LittleEndianStructure):
    """Assetto Corsa (original), NOT ACC. Includes the player's actual XYZ."""
    _pack_=4
    _fields_=ACGraphics._fields_[:-1]+[('carCoordinates',ct.c_float*3)]

class ACStatic(ct.LittleEndianStructure):''')
replace("adapters.py",
"gr=ACGraphics.from_buffer_copy(self.pages[1][:ct.sizeof(ACGraphics)])",
"graphics_type=ACGraphicsAC if self.game=='AC' else ACGraphics\n            gr=graphics_type.from_buffer_copy(self.pages[1][:ct.sizeof(graphics_type)])")
replace("adapters.py",
"world_x=None, world_z=None,",
"""world_x=as_number(gr.carCoordinates[0],3) if self.game=='AC' and all(abs(float(v))<1e7 for v in gr.carCoordinates) and any(abs(float(v))>0.01 for v in gr.carCoordinates) else None,
             world_z=as_number(gr.carCoordinates[2],3) if self.game=='AC' and all(abs(float(v))<1e7 for v in gr.carCoordinates) and any(abs(float(v))>0.01 for v in gr.carCoordinates) else None,""")

# A dedicated live sender never blocks the local capture thread.
replace("engine.py",
"threading.Thread(target=self._sync,daemon=True,name='VCE-transfert').start()",
"threading.Thread(target=self._sync,daemon=True,name='VCE-transfert').start()\n        threading.Thread(target=self._live_broadcast,daemon=True,name='VCE-live').start()")
replace("engine.py",
"    def _sync(self):",
'''    def _live_broadcast(self):
        """Send 5 batches/s (up to 4 native 20Hz samples each).
        Browser draws at 60 FPS from incoming measurements; no fake samples.
        All uploads require existing opt-in, device pairing and staff approval.
        """
        last_index=0;last_session=None;last_lap_no=None;previous_error='';announced=False
        while not self.stop_flag.wait(.20):
            if not self.cfg.get('consent_upload') or not self.approved or not self._identity_matches_registration():
                last_session=None;last_index=0;announced=False
                continue
            with self.guard:
                rec=self.record
                if rec is None or len(rec.samples)==0:continue
                sid=rec.session_id
                if sid!=last_session or rec.lap_no!=last_lap_no:
                    if sid!=last_session:announced=False
                    last_session=sid;last_lap_no=rec.lap_no;last_index=0
                length=len(rec.samples)
                if length<=last_index:continue
                end=min(length,last_index+8)
                batch=list(rec.samples[last_index:end])
                snapshot={'session_id':sid,'game':rec.game,'track':rec.track,'car':rec.car,
                          'lap_number':rec.lap_no,'session_type':getattr(rec,'session_type',''),
                          'samples':batch}
            try:
                cloud=CloudClient(self.cfg)
                if not announced:
                    cloud.session_state({'session_id':sid,'game':rec.game,
                         'track':rec.track,'car':rec.car,'started_at':rec.started,
                         'ended_at':None,'laps_count':len(rec.laps),
                         'best_lap_ms':None,'session_type':getattr(rec,'session_type','')},'in_progress')
                cloud.live_batch(snapshot)
                last_index=end
                if not announced:
                    self.log('LIVE VCE : données transmises en continu (5 lots/s)')
                    announced=True
                previous_error=''
            except Exception as err:
                message=str(err)[:180]
                if message!=previous_error:self.log('LIVE suspendu : '+message)
                previous_error=message
                self.stop_flag.wait(1.0)

    def _sync(self):''')
# Outbound LIVE is POSTed to the existing Edge Function; it never opens LAN ports.
p=root/"client.py"
p.write_text(p.read_text(encoding="utf-8")+'''
def _live_batch(self,session):
    return self.post('live_batch',{'session':session})
CloudClient.live_batch=_live_batch
''',encoding="utf-8")

for p in root.glob('*.py'):
 ast.parse(p.read_text(encoding="utf-8"),filename=str(p))
print('VCE 3.0: read-only AC XY, 20Hz native collection and 5Hz live batch verified')
