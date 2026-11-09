"""VCE 3.9: background sync, privacy-safe network diagnostics, LMU live resilience.
No game files, hooks, DLLs, protected processes or EAC components are modified.
"""
from pathlib import Path
import ast
root=Path("agent")
def edit(name, old, new):
    p=root/name;s=p.read_text(encoding="utf-8")
    if s.count(old)!=1:raise RuntimeError(f"{name}: expected one anchor: {old[:80]}")
    p.write_text(s.replace(old,new,1),encoding="utf-8")
edit("release_updates.py","VERSION='3.8.0'","VERSION='3.9.0'")
# Ensure the native LMU adapter is the first choice and not a DuckDB recording.
p=root/"adapters.py";s=p.read_text(encoding="utf-8")
assert "from vce_lmu_native import LMUAdapter" in s
# The shared memory may not publish a frame immediately after opening LMU.
# Do not treat transient absence as a fatal adapter error.
p=root/"vce_lmu_native.py";s=p.read_text(encoding="utf-8")
s=s.replace("self.last_lap = None","self.last_lap = None\n        self.last_valid_at = 0.0",1)
s=s.replace("self.last_elapsed = elapsed\n        self.last_lap = car.mLapNumber","self.last_elapsed = elapsed\n        self.last_lap = car.mLapNumber\n        self.last_valid_at = time.monotonic()",1)
p.write_text(s,encoding="utf-8")
# Keep checking official GitHub releases while the app stays in the tray.
# No restart or remote code execution without a verified installer.
app=root/"app.py";app_source=app.read_text(encoding="utf-8")
old="self.root.after(3000,self._check_updates_background)"
if app_source.count(old)!=1:raise RuntimeError("Updater startup anchor missing")
app_source=app_source.replace(old,old+"\\n        self.root.after(6*60*60*1000,self._vce_periodic_update_check)",1)
method="    def _load_remote_preferences(self):"
if app_source.count(method)!=1:raise RuntimeError("Updater preferences anchor missing")
app_source=app_source.replace(method,'''    def _vce_periodic_update_check(self):
        if not self.alive:return
        if not getattr(self,'updating',False):self._check_updates_background()
        self.root.after(6*60*60*1000,self._vce_periodic_update_check)

'''+method,1)
app.write_text(app_source,encoding="utf-8")
# The native archive scanner must never hammer LMU's recording files while the game runs.
engine=(root/"engine.py").read_text(encoding="utf-8")
if "last_lmu_poll" not in engine or "self.lmu.poll()" not in engine:\n    raise RuntimeError("V3.7 LMU safe archive polling not installed")
assert "threading.Thread(target=self._live_broadcast" in engine
assert "threading.Thread(target=self._sync" in engine
# Log a short actionable message instead of dumping Cloudflare HTML or credentials.
p=root/"client.py";s=p.read_text(encoding="utf-8")
s+='''
# VCE 3.9: protect UI logs from proxy HTML, secrets and repeated verbose errors.
import re as _vce_re39
def _vce_safe_cloud_error39(error):
    raw=str(error)
    if ("<!DOCTYPE" in raw or "<html" in raw.lower()) and ("403" in raw or "Forbidden" in raw):
        return "HTTP 403 (page HTML du proxy) : accès Edge Function refusé avant traitement; vérifier URL Supabase, routage et règles du proxy"
    if "<html" in raw.lower() or "<!doctype" in raw.lower():
        return "Réponse HTML inattendue du serveur; vérifier endpoint Supabase et proxy"
    raw=_vce_re39.sub(r'(?i)(bearer\\s+)[a-z0-9._~-]+',r'\\1[masqué]',raw)
    raw=_vce_re39.sub(r'(?i)(device_secret|apikey|access_token|refresh_token)([=: ]+)([^\\s,;]+)',r'\\1\\2[masqué]',raw)
    return raw[:180]
_vce_old_post39=CloudClient.post
def _vce_post39(self,*args,**kwargs):
    try:return _vce_old_post39(self,*args,**kwargs)
    except Exception as error:
        raise CloudError(_vce_safe_cloud_error39(error)) from None
CloudClient.post=_vce_post39
'''
p.write_text(s,encoding="utf-8")
for path in root.glob("*.py"):ast.parse(path.read_text(encoding="utf-8"),filename=str(path))
print("VCE 3.9 source checks passed; LMU read-only and background workers preserved")
