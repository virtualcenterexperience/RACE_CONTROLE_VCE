"""VCE 3.7: safe LMU detection with NO LMU/EAC process scanning or game changes.

- LMU presence is derived only from the game's official read-only LMU_Data mapping.
- Steam installation check reads manifests, never the game's DLLs.
- Native live capture is independent from the 10s read-only DuckDB archive poll.
- A missing mapping produces a useful diagnostic, not aggressive retries.
"""
from pathlib import Path
import ast

root = Path("agent")


def change(name, old, new):
    path = root / name
    src = path.read_text(encoding="utf-8")
    n = src.count(old)
    if n != 1:
        raise RuntimeError(f"{name}: v3.7 incompatible source ({n} anchors): {old[:100]}")
    path.write_text(src.replace(old, new, 1), encoding="utf-8")


change("release_updates.py", "VERSION='3.6.0'", "VERSION='3.7.0'")

# Override LMU detection; old scanner is retained for OTHER games only.
# When LMU_Data is published or LMU-only mode is selected, we do not enumerate
# processes at all, including the protected LMU/EAC processes.
core = root / "core.py"
src = core.read_text(encoding="utf-8")
if src.count("def scan_games():") != 1:
    raise RuntimeError("core.py: original scanner not found")
src += '''
# VCE 3.7: no process-based LMU detection, no DLL or game file inspection.
from vce_lmu_safe_scan import lmu_mapping_available, safe_lmu_inventory
_vce_legacy_scan_games37 = scan_games
GAMES["LMU"]["processes"] = ()  # never match LMU by its process name

def scan_games(only_lmu=False):
    mapping = lmu_mapping_available()
    if only_lmu or mapping:
        # Only read Windows' official named mapping and Steam install manifests.
        # No process enumeration when LMU is selected or publishing telemetry.
        return safe_lmu_inventory(GAMES, mapping_active=mapping)
    result = _vce_legacy_scan_games37()  # other games: names only
    if "LMU" in result:
        result["LMU"]["running"] = False
    return result
'''
core.write_text(src, encoding="utf-8")

change("engine.py",
    "current=None;adapter=None;rec=None;last_live=0;last_scan=0;game=None;next_open=0;last_rate_at=0;last_rate_count=0;rate_session=None",
    "current=None;adapter=None;rec=None;last_live=0;last_scan=0;game=None;next_open=0;last_rate_at=0;last_rate_count=0;rate_session=None;last_lmu_poll=0;last_lmu_hint=-1000000")

change("engine.py",
    "try:found=scan_games();active=self._select(found)",
    """try:
                        found=scan_games(only_lmu=self.cfg.get('enabled_game')=='LMU')
                        active=self._select(found)
                        if (found.get('LMU',{}).get('installed') and
                            not found['LMU'].get('running') and not active and
                            now-last_lmu_hint>=300):
                            last_lmu_hint=now
                            self.log('LMU : si le jeu est ouvert mais non reconnu, activer Enable Plugins dans les paramètres du jeu puis le redémarrer. VCE ne modifie aucun fichier LMU.')""")

change("engine.py",
    "                        game=active\n",
    "                        game=active\n                        next_open=0\n")

change("engine.py",
    "self.status('EN COURS · LMU (fichier natif)')",
    "self.status('LMU DÉTECTÉ · EN ATTENTE DE TÉLÉMÉTRIE')")

change("engine.py",
    "                    if adapter is None:\n",
    "                    if adapter is None and now>=next_open:\n")

change("engine.py",
    """                        except Exception:
                            with self.guard:self.presence_state='game_detected'
                            self.status('EN ATTENTE DE SESSION · '+game)""",
    """                        except Exception as exc:
                            next_open=now+3
                            if game=='LMU' and now-last_lmu_hint>=60:
                                self.log('LMU : mémoire partagée temporairement indisponible ('+str(exc)[:110]+')')
                                last_lmu_hint=now
                            with self.guard:self.presence_state='game_detected'
                            self.status('EN ATTENTE DE SESSION · '+game)""")

change("engine.py",
    "self.log('Lecture indisponible : '+str(e));adapter.close();adapter=None;frame=None",
    "self.log('Lecture indisponible : '+str(e));adapter.close();adapter=None;frame=None;next_open=now+3")

# Important: V3.6 polled LMU's recording folders up to ~333 times PER SECOND.
# This never wrote to the game, but was needless disk activity. Now 10s max.
change("engine.py",
    "if game=='LMU' or self.cfg.get('enabled_game')=='AUTO':\n                    for file in self.lmu.poll():",
    """if (game=='LMU' or self.cfg.get('enabled_game')=='AUTO') and now-last_lmu_poll>=10:
                    last_lmu_poll=now
                    for file in self.lmu.poll():""")

change("engine.py",
    "time.sleep(.003 if game in SUPPORTED_LIVE else .5)",
    "time.sleep(.005 if game in SUPPORTED_LIVE else .5)")

for path in root.glob("*.py"):
    ast.parse(path.read_text(encoding="utf-8"), filename=str(path))

from pathlib import Path as _Path
lm = (root / "vce_lmu_native.py").read_text(encoding="utf-8")
scan = (root / "vce_lmu_safe_scan.py").read_text(encoding="utf-8")
assert 'OpenFileMappingW(FILE_MAP_READ' in lm
assert 'OpenFileMappingW(FILE_MAP_READ' in scan
for forbidden in ("OpenProcess(", "WriteProcessMemory(", "CreateRemoteThread(",
                  "SetWindowsHookEx(", "LoadLibraryW(", "version.dll"):
    assert forbidden not in lm and forbidden not in scan, forbidden
assert "only_lmu=self.cfg.get('enabled_game')=='LMU'" in (root / "engine.py").read_text(encoding="utf-8")
print("VCE 3.7: safe LMU mapping discovery, no LMU process scan, 10s archive poll, Python syntax OK")
