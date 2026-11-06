"""VCE 3.5 — reliable high-frequency capture, completed-session persistence and diagnostics.
Applies after patch_v34.py. Never fabricates game frames or measured track boundaries.
"""
from pathlib import Path
import ast
root=Path("agent")
def change(file,old,new):
    path=root/file
    source=path.read_text(encoding="utf-8")
    n=source.count(old)
    if n!=1:raise RuntimeError(f"{file}: expected 1 anchor got {n}: {old[:90]}")
    path.write_text(source.replace(old,new,1),encoding="utf-8")

change("release_updates.py","VERSION='3.4.0'","VERSION='3.5.0'")
# Preserve a last partial lap instead of discarding it when the player leaves the server.
# A partial lap is never reported as a valid timed lap.
change("core.py",
    """    def finish(self):
        self.state='stopped'
        return self.save()""",
    """    def finish(self):
        if self.state!='stopped' and self.samples and len(self.samples)>=10:
            lap_number=(self.lap_no or 0)+1
            if not any(l.get('lap_number')==lap_number for l in self.laps):
                self.laps.append({'lap_number':lap_number,'lap_time_ms':None,
                    'samples':list(self.samples),'valid':False,
                    'partial':True,'sample_count':len(self.samples)})
        self.state='stopped'
        return self.save()""")
# Ensure a large 120Hz lap does not exceed server's bounded 100k sample contract.
change("core.py","if len(self.samples)>200000:self.samples=self.samples[-200000:]",
    "if len(self.samples)>100000:self.samples=self.samples[-100000:]")
# Session closure explicitly wakes the sender. The sender must not wait 15s
# before noticing finalized files (it still retries failed uploads later).
change("engine.py",
    "if now-last_upload<max(5,min(120,int(self.cfg.get('sync_delay_s',15)))):continue",
    """pending=any((self.root/'sessions').glob('*.json'))
            if now-last_upload<max(1,min(120,int(self.cfg.get('sync_delay_s',15)))) and not pending:continue""")
# The former "pending" test includes already uploaded files, so throttle normal
# traffic while allowing immediate unsent archive delivery.
change("engine.py",
    "pending=any((self.root/'sessions').glob('*.json'))",
    """pending=any(path.stem not in self.sent_sessions
                for path in (self.root/'sessions').glob('*.json'))""")
# Report native capture rate from the sample timestamps, not UI/network frame rate.
change("engine.py","current=None;adapter=None;rec=None;last_live=0;last_scan=0;game=None;next_open=0",
    "current=None;adapter=None;rec=None;last_live=0;last_scan=0;game=None;next_open=0;last_rate_at=0;last_rate_count=0;rate_session=None")
change("engine.py",
    """                            rec.feed(frame)
                            with self.guard:self.record=rec""",
    """                            rec.feed(frame)
                            if rec.session_id!=rate_session:
                                rate_session=rec.session_id;last_rate_at=now;last_rate_count=len(rec.samples)
                            elif now-last_rate_at>=6:
                                count=len(rec.samples)
                                if count>=last_rate_count:
                                    actual=(count-last_rate_count)/max(.001,now-last_rate_at)
                                    self.log(f'CAPTURE AC/ACC : {actual:.1f} Hz RÉELS (cible 120 Hz, selon le jeu)')
                                last_rate_at=now;last_rate_count=count
                            with self.guard:self.record=rec""")
# Limit network calls from completed sessions to one in-flight archive per worker,
# persist success only after the whole session has been ACKed.
change("engine.py",
    """                    for lap in item['laps']:cloud.send_lap(item,lap)
                    cloud.session_state(item,'completed')""",
    """                    for lap in item['laps']:
                        response=cloud.send_lap(item,lap)
                        if response is None or response.get('ok') is not True:
                            raise RuntimeError('Tour non confirmé par Supabase, réessai plus tard')
                    done=cloud.session_state(item,'completed')
                    if done is None or done.get('ok') is not True:
                        raise RuntimeError('Session non confirmée par Supabase')""")
for p in root.glob("*.py"):
    ast.parse(p.read_text(encoding="utf-8"),filename=str(p))
print("VCE 3.5 — syntax OK, actual capture rate / last partial / confirmed archive")
