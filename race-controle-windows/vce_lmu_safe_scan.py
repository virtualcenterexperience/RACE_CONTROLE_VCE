"""LMU safe discovery: Windows-published read-only mapping and Steam manifests ONLY.

Never enumerates or opens the LMU process, game DLLs, EAC, or the game's memory.
No injection, process handles, hooks, filesystem writes or EAC workarounds.
"""
import ctypes
import os
import re
from pathlib import Path

FILE_MAP_READ = 0x0004


def lmu_mapping_available():
    """True iff LMU itself published the official LMU_Data mapping.

    Only OpenFileMappingW(FILE_MAP_READ) + CloseHandle are called. No view is
    mapped during discovery; the actual telemetry adapter maps read-only.
    """
    if os.name != "nt":
        return False
    from ctypes import wintypes
    try:
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.OpenFileMappingW.argtypes = (wintypes.DWORD, wintypes.BOOL, wintypes.LPCWSTR)
        kernel.OpenFileMappingW.restype = wintypes.HANDLE
        kernel.CloseHandle.argtypes = (wintypes.HANDLE,)
        kernel.CloseHandle.restype = wintypes.BOOL
        handle = kernel.OpenFileMappingW(FILE_MAP_READ, False, "LMU_Data")
        if not handle:
            return False
        kernel.CloseHandle(handle)
        return True
    except (OSError, AttributeError, ValueError):
        return False


def steam_manifest_inventory(games):
    """Read Steam's install manifest names, not game files or processes."""
    from steam_identity import steam_paths
    libraries = []
    for root in steam_paths():
        libraries.append(root)
        vdf = root / "steamapps" / "libraryfolders.vdf"
        try:
            if vdf.is_file():
                raw = vdf.read_text(encoding="utf-8-sig", errors="replace")
                for value in re.findall(r'"path"\s*"([^"]+)"', raw):
                    libraries.append(Path(value.replace("\\\\", "\\")))
        except (OSError, UnicodeError):
            continue
    libraries = list(dict.fromkeys(libraries))
    return {
        code: any((lib / "steamapps" / ("appmanifest_" + info["steam_id"] + ".acf")).is_file()
                  for lib in libraries)
        for code, info in games.items()
    }


def safe_lmu_inventory(games, mapping_active=None):
    """Inventory without process enumeration; other games have no running status."""
    installed = steam_manifest_inventory(games)
    active = lmu_mapping_available() if mapping_active is None else bool(mapping_active)
    return {
        code: {"installed": installed.get(code, False),
               "running": code == "LMU" and active,
               "name": info["name"]}
        for code, info in games.items()
    }
