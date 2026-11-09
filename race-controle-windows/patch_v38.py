"""VCE 3.8: version bump and build-time integrity guards.
No claims of live-game or anti-cheat validation are made by this build check.
"""
from pathlib import Path
import ast
root = Path("agent")
release = root / "release_updates.py"
src = release.read_text(encoding="utf-8")
old = "VERSION='3.7.0'"
if src.count(old) != 1:
    raise RuntimeError("Version 3.7 source not found exactly once")
release.write_text(src.replace(old, "VERSION='3.8.0'", 1), encoding="utf-8")
for name in ("app.py", "core.py", "engine.py", "adapters.py", "vce_lmu_native.py", "vce_lmu_safe_scan.py"):
    ast.parse((root / name).read_text(encoding="utf-8"), filename=name)
print("VCE 3.8: version and Python syntax verified; hardware validation still required")
