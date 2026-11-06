"""VCE 3.4 — target native 120 Hz sampling and bounded lap uploads.
The actual number of distinct game frames is measured, never invented.
"""
from pathlib import Path
import ast
root=Path("agent")
def replace(name,old,new):
    p=root/name
    src=p.read_text(encoding="utf-8")
    count=src.count(old)
    if count!=1:
        raise RuntimeError(f"Source incompatible in {name}: expected one anchor, got {count}: {old[:80]}")
    p.write_text(src.replace(old,new,1),encoding="utf-8")

replace("release_updates.py","VERSION='3.3.0'","VERSION='3.4.0'")
replace("core.py","return round(y,ndigits)","return round(y,ndigits)")
replace("core.py","'t':round(self.timestamp,3)","'t':round(self.timestamp,6)")
replace("core.py",
        "if frame.timestamp-self.last_sample_time<0.047:return",
        "if frame.timestamp-self.last_sample_time < (1.0 / 120.0):return")
replace("core.py",
        "# Downsample to ~20Hz to reduce storage while retaining useful brake/throttle data.",
        "# Target 120 Hz native samples when the game supplies fresh frames. No interpolation.")
replace("engine.py","time.sleep(.06 if game in SUPPORTED_LIVE else .5)",
        "time.sleep(.003 if game in SUPPORTED_LIVE else .5)")
# Preserve near-live high-frequency inputs while never blocking the local capture thread.
replace("engine.py","while not self.stop_flag.wait(.20):",
        "while not self.stop_flag.wait(.10):")
replace("engine.py","end=min(length,last_index+8)","end=min(length,last_index+12)")
replace("engine.py","self.log('LIVE INPUTS : flux actif · accélérateur / frein / volant / vitesse / rapports · lots ~5 Hz')",
        "self.log('LIVE INPUTS : échantillonnage cible 120 Hz · télémétrie diffusée par lots ~10 Hz')")
# Use small numbered batches on the server: avoids the old 500 kB HTTP cap and
# preserves all available 120 Hz samples instead of silently truncating them.
replace("client.py",
"""    def send_lap(self,session,lap):
        return self.post('upload',{'session':{
           'session_id':session['session_id'],'game':session['game'],
           'track':session.get('track',''),'car':session.get('car',''),
           'started_at':session['started_at'],'ended_at':session.get('ended_at'),
           'laps_count':session.get('laps_count'), 'best_lap_ms':session.get('best_lap_ms')},
           'lap':lap})""",
"""    def send_lap(self,session,lap):
        summary={'session_id':session['session_id'],'game':session['game'],
           'track':session.get('track',''),'car':session.get('car',''),
           'started_at':session['started_at'],'ended_at':session.get('ended_at'),
           'laps_count':session.get('laps_count'),'best_lap_ms':session.get('best_lap_ms')}
        samples=lap.get('samples') or []
        if len(samples)<=160:
            return self.post('upload',{'session':summary,'lap':lap})
        total=len(samples)
        last=None
        for offset in range(0,total,120):
            segment=dict(lap)
            segment['samples']=samples[offset:offset+120]
            last=self.post('upload_segment',{'session':summary,'lap':segment,
                'offset':offset,'total_samples':total})
            if last.get('offset')!=offset+len(segment['samples']):
                raise CloudError('Ack segment incohérent : tour à reprendre')
        if not last or last.get('complete') is not True:
            raise CloudError('Transmission du tour incomplète')
        return last""")
for file in root.glob("*.py"):
    ast.parse(file.read_text(encoding="utf-8"),filename=str(file))
print("VCE 3.4 Python source parsed: 120 Hz target and segmented HTTP uploads")
