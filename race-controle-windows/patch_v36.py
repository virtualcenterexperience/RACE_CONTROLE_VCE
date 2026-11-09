"""VCE 3.6: EAC-compatible native LMU read-only adapter, reliable live transport,
local ANTICHEAT exports, and visible input diagnostics.
Apply AFTER patch_v35.py. No game DLLs, hooks, process injection, or EAC bypass.
"""
from pathlib import Path
import ast

root = Path("agent")


def replace_once(file, old, new):
    p = root / file
    source = p.read_text(encoding="utf-8")
    hits = source.count(old)
    if hits != 1:
        raise RuntimeError(f"{file}: expected one anchor, got {hits}: {old[:90]}")
    p.write_text(source.replace(old, new, 1), encoding="utf-8")


replace_once("release_updates.py", "VERSION='3.5.0'", "VERSION='3.6.0'")

# Replace only the LMU adapter; existing AC/ACC behavior is preserved.
p = root / "adapters.py"
s = p.read_text(encoding="utf-8")
if "def open_adapter(" not in s:
    raise RuntimeError("No open_adapter in adapters.py")
s += '''
# VCE 3.6: native game-published shared memory; never install any LMU DLL.
_vce_previous_open_adapter36 = open_adapter
def open_adapter(game):
    if game == 'LMU':
        from vce_lmu_native import LMUAdapter
        return LMUAdapter()
    return _vce_previous_open_adapter36(game)
'''
p.write_text(s, encoding="utf-8")

p = root / "engine.py"
s = p.read_text(encoding="utf-8")
start = s.index("    def _live_broadcast(self):")
end = s.index("    def _sync(self):", start)
live = s[start:end]
if live.count("cloud=CloudClient(self.cfg)") != 1:
    raise RuntimeError("Expected one CloudClient construction inside LIVE")
live = live.replace(
    "        last_index=0;last_session=None;last_lap_no=None;previous_error='';announced=False",
    "        last_index=0;last_session=None;last_lap_no=None;previous_error='';announced=False\\n"
    "        cloud=CloudClient(self.cfg)\\n        lag_reported=False"
)
live = live.replace("                cloud=CloudClient(self.cfg)\\n", "")
if live.count("end=min(length,last_index+12)") != 1:
    raise RuntimeError("LIVE batch size source changed")
live = live.replace(
    "                end=min(length,last_index+12)",
    """                # Network can be slower than capture: keep live latency bounded.
                # Skipped live frames remain in the local full-session archive.
                if length-last_index>120:
                    last_index=max(0,length-24)
                    if not lag_reported:
                        self.log('LIVE : retard réseau, priorité aux mesures récentes ; archive complète conservée')
                        lag_reported=True
                end=min(length,last_index+12)"""
)
s = s[:start] + live + s[end:]
# Extend native polling to LMU without changing other game adapters.
s += '''
# Native LMU_Data is read-only and published by the game itself.
# Keep native game timestamps: do not invent 120 Hz by repeating old frames.
try:
    SUPPORTED_LIVE = tuple(dict.fromkeys(tuple(SUPPORTED_LIVE) + ('LMU',)))
except NameError:
    SUPPORTED_LIVE = ('AC', 'ACC', 'LMU')

# Independent archive worker; neither game capture nor network upload waits on CSV.
from vce_local_archive import start_archiver as _vce_start_archiver36
for _name, _candidate in list(globals().items()):
    if (isinstance(_candidate, type) and _candidate.__module__ == __name__
            and hasattr(_candidate, '_sync') and hasattr(_candidate, 'log')):
        _vce_engine_type36 = _candidate
        break
else:
    raise RuntimeError('VCE Engine class not found; cannot attach local archive')
_vce_original_engine_init36 = _vce_engine_type36.__init__
def _vce_engine_init36(self, *args, **kwargs):
    _vce_original_engine_init36(self, *args, **kwargs)
    self._vce_archive_thread = _vce_start_archiver36(self.root, self.stop_flag, self.log)
_vce_engine_type36.__init__ = _vce_engine_init36
'''
p.write_text(s, encoding="utf-8")

# The pilot can open the export directory directly from the small native app.
p = root / "app.py"
s = p.read_text(encoding="utf-8")
old = "        self.permission_button.pack(side='right')"
if s.count(old) != 1:
    raise RuntimeError("Pilot transfer permission UI anchor missing")
s = s.replace(old, old + """
        self.archive_button=self._button(permission,'ARCHIVES LOCALES',self.open_local_archives)
        self.archive_button.pack(side='right',padx=(0,8))""", 1)
old = "    def refresh_permission(self):"
if s.count(old) != 1:
    raise RuntimeError("refresh_permission UI anchor missing")
s = s.replace(old, """    def open_local_archives(self):
        try:
            from vce_local_archive import archive_root
            folder=archive_root(self.engine.root)
            if os.name=='nt':os.startfile(str(folder))
            else:self.log_msg('Archives locales : '+str(folder))
        except Exception as exc:
            self.log_msg('Impossible d’ouvrir les archives : '+str(exc))

""" + old, 1)
p.write_text(s, encoding="utf-8")

for path in root.glob("*.py"):
    ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
print("VCE 3.6: source syntax OK, LMU native read-only, bounded live and local archives")
