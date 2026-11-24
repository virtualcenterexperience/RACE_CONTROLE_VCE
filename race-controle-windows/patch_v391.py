"""VCE 3.9.1: fresh live positions and acknowledged laps during driving.
No changes to game files, native capture rate, access checks or archive samples.
"""
from pathlib import Path
import ast

def replace(name, old, new):
    p=Path('agent')/name
    source=p.read_text(encoding='utf-8')
    if source.count(old)!=1:raise RuntimeError(f'{name}: source anchor mismatch: {old[:70]}')
    p.write_text(source.replace(old,new,1),encoding='utf-8')

replace('release_updates.py', "VERSION='3.9.0'", "VERSION='3.9.1'")
# A sequential HTTPS call takes time: never replay a backlog of old positions.
# Select up to 12 original samples spread across the unsent 200 ms window.
# Never change or downsample the full local archive.
replace('engine.py', "from pathlib import Path", "from pathlib import Path\nfrom vce_transport import recent_live_batch")
replace('engine.py', """                if length-last_index>120:
                    last_index=max(0,length-24)
                    if not lag_reported:
                        self.log('LIVE : retard réseau, priorité aux mesures récentes ; archive complète conservée')
                        lag_reported=True
                end=min(length,last_index+12)
                batch=list(rec.samples[last_index:end])""", """                batch,end=recent_live_batch(rec.samples,last_index)
                if not batch:continue""")
replace('engine.py', "last_status=0;last_upload=0;last_cloud_error=''", "last_status=0;last_upload=0;last_cloud_error=''\n        acknowledged_laps=set()")
replace('engine.py', """                    cloud.session_state(summary,'in_progress')
                    self.log('EN COURS envoyé au serveur · '+active.game)""", """                    # Copy completed laps under the capture lock, send outside it.
                    # Only completed laps; the current lap remains in native capture.
                    with self.guard:
                        finished_laps=list(active.laps)
                    for lap in finished_laps:
                        if not self.cfg.get('consent_upload',False):break
                        key=(summary['session_id'],lap['lap_number'])
                        if key in acknowledged_laps:continue
                        cloud.send_lap(summary,lap)
                        acknowledged_laps.add(key)
                    if self.cfg.get('consent_upload',False):
                        cloud.session_state(summary,'in_progress')
                    self.log('EN COURS envoyé au serveur · '+active.game)""")
replace('engine.py', """                        cloud.send_lap(item,lap)""", """                        key=(sid,lap['lap_number'])
                        if key not in acknowledged_laps:
                            cloud.send_lap(item,lap)
                            acknowledged_laps.add(key)""")
# A newly finished lap bypasses the regular heartbeat delay (worker wakes <=2s).
replace('engine.py', """            pending=any(path.stem not in self.sent_sessions
                for path in (self.root/'sessions').glob('*.json'))""", """            pending=any(path.stem not in self.sent_sessions
                for path in (self.root/'sessions').glob('*.json'))
            with self.guard:
                current=self.record
                pending=pending or bool(current and any(
                    (current.session_id,lap['lap_number']) not in acknowledged_laps
                    for lap in current.laps))""")
# The existing server accepts 160 samples/segment; retain exact sample order.
replace('client.py', 'for offset in range(0,total,120):', 'for offset in range(0,total,160):')
replace('client.py', "segment['samples']=samples[offset:offset+120]", "segment['samples']=samples[offset:offset+160]")
for p in Path('agent').glob('*.py'):ast.parse(p.read_text(encoding='utf-8'),filename=str(p))
print('VCE 3.9.1: fresh live, complete lap uploads and source syntax verified')
