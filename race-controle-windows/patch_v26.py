"""Race Controle VCE 2.6.0 — stable installer version and safe diagnostics."""
from pathlib import Path
import ast
root=Path("agent")
p=root/"release_updates.py"
s=p.read_text(encoding="utf-8")
if s.count("VERSION='2.5.0'") != 1:
    raise RuntimeError("Unexpected previous VCE version; aborting build")
p.write_text(s.replace("VERSION='2.5.0'","VERSION='2.6.0'"),encoding="utf-8")
for file in root.glob("*.py"):
    ast.parse(file.read_text(encoding="utf-8"),filename=str(file))
print("VCE 2.6.0 source syntax verified")
