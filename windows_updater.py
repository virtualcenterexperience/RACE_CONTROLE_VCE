"""VCE Race Control - GitHub Releases updater (integration module).
Requires an application entrypoint to call check_for_update().
Never runs downloaded executables without user consent and SHA-256 validation.
"""
import hashlib
import json
import os
import subprocess
import tempfile
import urllib.request
from pathlib import Path
from packaging.version import Version

RELEASE_API = "https://api.github.com/repos/virtualcenterexperience/RACE_CONTROLE_VCE/releases/latest"
CURRENT_VERSION = "3.0.0"
MAX_INSTALLER_BYTES = 300 * 1024 * 1024

def _fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "VCE-Race-Control-Updater", "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=15) as response:
        return json.load(response)

def check_for_update(current_version=CURRENT_VERSION):
    """Returns update metadata or None. Network errors propagate to caller."""
    release = _fetch_json(RELEASE_API)
    tag = str(release.get("tag_name", "")).lstrip("vV")
    if not tag or Version(tag) <= Version(current_version):
        return None
    assets = release.get("assets") or []
    installers = [a for a in assets if a.get("name", "").lower().endswith(".exe")
                  and "setup" in a.get("name", "").lower()]
    checksums = [a for a in assets if a.get("name", "").lower() == "sha256sums.txt"]
    if len(installers) != 1 or len(checksums) != 1:
        raise ValueError("Release must contain exactly one Setup EXE and SHA256SUMS.txt")
    installer = installers[0]
    if not 0 < int(installer.get("size", 0)) <= MAX_INSTALLER_BYTES:
        raise ValueError("Invalid installer size")
    return {"version": tag, "installer": installer, "checksums": checksums[0],
            "notes": release.get("body") or "", "release_url": release.get("html_url")}

def _download(url, dest, max_bytes):
    req = urllib.request.Request(url, headers={"User-Agent": "VCE-Race-Control-Updater"})
    total = 0
    with urllib.request.urlopen(req, timeout=45) as source, open(dest, "wb") as output:
        while True:
            block = source.read(1024 * 1024)
            if not block: break
            total += len(block)
            if total > max_bytes:
                raise ValueError("Download exceeds permitted size")
            output.write(block)

def prepare_update(info):
    """Download and verify installer. Does NOT execute it."""
    folder = Path(tempfile.mkdtemp(prefix="vce-update-"))
    installer = info["installer"]["name"]
    if Path(installer).name != installer or not installer.lower().endswith(".exe"):
        raise ValueError("Unsafe installer name")
    checksum_file = folder / "SHA256SUMS.txt"
    setup_file = folder / installer
    _download(info["checksums"]["browser_download_url"], checksum_file, 256 * 1024)
    expected = None
    for line in checksum_file.read_text(encoding="utf-8-sig").splitlines():
        parts = line.strip().split(maxsplit=1)
        if len(parts) == 2 and parts[1].lstrip("*").strip() == installer:
            expected = parts[0].lower()
    if not expected or len(expected) != 64 or any(c not in "0123456789abcdef" for c in expected):
        raise ValueError("Valid SHA-256 checksum not found")
    _download(info["installer"]["browser_download_url"], setup_file, MAX_INSTALLER_BYTES)
    actual = hashlib.sha256(setup_file.read_bytes()).hexdigest()
    if actual != expected:
        setup_file.unlink(missing_ok=True)
        raise ValueError("Installer checksum mismatch")
    return setup_file

def launch_verified_installer(installer_path, user_approved=False):
    """Only call after explicit user approval and after closing/saving the app."""
    if not user_approved:
        raise PermissionError("User approval required before launching installer")
    if os.name != "nt":
        raise OSError("Windows only")
    return subprocess.Popen([str(installer_path)])
