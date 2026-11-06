"""VCE 3.1 — clearer live input transport diagnostics and version bump.
The agent already samples throttle, brake, steer, speed and gear.
This patch does not alter native memory layouts or add unsafe game hooks.
"""
from pathlib import Path
import ast
root=Path("agent")
p=root/"release_updates.py"
s=p.read_text(encoding="utf-8")
assert s.count("VERSION='3.0.0'")==1, "Unexpected source version"
p.write_text(s.replace("VERSION='3.0.0'","VERSION='3.1.0'",1),encoding="utf-8")
p=root/"engine.py"
s=p.read_text(encoding="utf-8")
old="self.log('LIVE VCE : données transmises en continu (5 lots/s)')"
new="self.log('LIVE INPUTS : flux actif · accélérateur / frein / volant / vitesse / rapports · lots ~5 Hz')"
assert s.count(old)==1, "Live sender log anchor missing"
s=s.replace(old,new,1)
p.write_text(s,encoding="utf-8")
for p in root.glob("*.py"):
 ast.parse(p.read_text(encoding="utf-8"),filename=str(p))
print("VCE 3.1 source syntax OK; native input sampling unchanged")
