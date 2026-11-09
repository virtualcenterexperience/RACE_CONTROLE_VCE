"""Offline session archive for VCE pilots.
ANTICHEAT is a user-requested *folder name*, not an EAC exception or bypass.
No game files, plugins, or memory are modified. Never stores VCE credentials.
"""
import csv
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile
import threading
import time

MAX_SOURCE_BYTES = 250 * 1024 * 1024
SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{6,100}$")
META = ("session_id", "game", "track", "car", "session_type",
        "started_at", "ended_at", "laps_count", "best_lap_ms", "status")
LAP_META = ("lap_number", "lap_time_ms", "valid", "partial", "sample_count")
README = """RACE CONTROL VCE — ANTICHEAT / ARCHIVES LOCALES

Ce dossier contient les sessions sauvegardées sur CE PC.
Il ne désactive pas et ne contourne pas Easy Anti-Cheat.
RACE CONTROL VCE n'installe aucune DLL dans Le Mans Ultimate.

Chaque session :
  <identifiant>.json  : session et échantillons disponibles, format VCE
  <identifiant>.csv   : échantillons avec colonnes par canal
  <identifiant>.sha256: empreinte SHA-256 du fichier JSON

Les valeurs absentes restent vides : aucun capteur n'est inventé.
Les fichiers restent locaux, même sans connexion Supabase.
La transmission en ligne exige le consentement du pilote et l'accord STAFF.

MoTeC i2 : CSV et JSON ne sont PAS des fichiers natifs .ld/.ldx.
Utilisez un convertisseur compatible ou l'export natif LMU adapté à MoTeC.
Pour les originaux LMU : <Steam>\\steamapps\\common\\Le Mans Ultimate\\UserData\\Telemetry
LMU enregistre les .duckdb si l'enregistrement de télémétrie est activé.
"""


def archive_root(fallback):
    if getattr(sys, "frozen", False):
        candidate = Path(sys.executable).resolve().parent / "ANTICHEAT"
    else:
        candidate = Path(fallback) / "ANTICHEAT"
    try:
        candidate.mkdir(parents=True, exist_ok=True)
        (candidate / ".vce-write-test").write_text("ok", encoding="utf-8")
        (candidate / ".vce-write-test").unlink(missing_ok=True)
    except OSError:
        candidate = Path(fallback) / "ANTICHEAT"
        candidate.mkdir(parents=True, exist_ok=True)
    readme = candidate / "LISEZ-MOI.txt"
    if not readme.exists():
        readme.write_text(README, encoding="utf-8")
    return candidate


def atomic_text(destination, content):
    temp = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="",
                                         prefix=".vce-", dir=destination.parent,
                                         delete=False) as f:
            temp = Path(f.name)
            f.write(content)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp, destination)
    finally:
        if temp:
            temp.unlink(missing_ok=True)


def safe_number(value):
    if type(value) not in (float, int) or not math.isfinite(value):
        return None
    return value


def clean_session(raw):
    result = {key: raw.get(key) for key in META}
    result["laps"] = []
    for lap in raw.get("laps", []):
        if not isinstance(lap, dict):
            continue
        cleaned = {key: lap.get(key) for key in LAP_META}
        cleaned["samples"] = []
        for sample in lap.get("samples", []):
            if not isinstance(sample, dict):
                continue
            # Numeric telemetry only: no tokens, IPs, passwords or arbitrary text.
            cleaned["samples"].append({
                str(k)[:70]: v for k, value in sample.items()
                if re.fullmatch(r"[a-z][a-z0-9_]{0,69}", str(k))
                if (v := safe_number(value)) is not None
            })
        result["laps"].append(cleaned)
    return result


def export_one(source, destination):
    stat = source.stat()
    if stat.st_size < 20 or stat.st_size > MAX_SOURCE_BYTES:
        return False
    if time.time() - stat.st_mtime < 3:
        return False  # don't copy a file the recorder may still be writing
    try:
        raw = json.loads(source.read_text(encoding="utf-8"))
    except (OSError, ValueError, UnicodeError):
        return False
    if not isinstance(raw, dict) or not isinstance(raw.get("laps"), list):
        return False
    session_id = str(raw.get("session_id") or source.stem)
    if not SAFE_ID.fullmatch(session_id):
        return False
    target = destination / session_id
    json_file = target.with_suffix(".json")
    csv_file = target.with_suffix(".csv")
    if json_file.exists() and csv_file.exists() and min(
            json_file.stat().st_mtime, csv_file.stat().st_mtime) >= stat.st_mtime:
        return False
    data = clean_session(raw)
    if not data["laps"]:
        return False
    serialized = json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    atomic_text(json_file, serialized)
    import hashlib
    atomic_text(target.with_suffix(".sha256"),
                hashlib.sha256(serialized.encode("utf-8")).hexdigest() + "  " + json_file.name + "\n")
    # Stream the CSV instead of assembling all rows in memory.
    keys = sorted({key for lap in data["laps"] for sample in lap["samples"] for key in sample})
    tmp = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="",
                                         prefix=".vce-csv-", dir=destination,
                                         delete=False) as out:
            tmp = Path(out.name)
            writer = csv.DictWriter(out, fieldnames=["lap_number"] + keys, extrasaction="ignore")
            writer.writeheader()
            for lap in data["laps"]:
                for sample in lap["samples"]:
                    writer.writerow({"lap_number": lap.get("lap_number"), **sample})
            out.flush()
            os.fsync(out.fileno())
        os.replace(tmp, csv_file)
    finally:
        if tmp:
            tmp.unlink(missing_ok=True)
    return True


def start_archiver(data_root, stop_event, log):
    data_root = Path(data_root)
    destination = archive_root(data_root)
    def worker():
        announced = False
        while not stop_event.is_set():
            try:
                source_dir = data_root / "sessions"
                if source_dir.is_dir():
                    for source in source_dir.glob("*.json"):
                        if stop_event.is_set():
                            break
                        try:
                            if export_one(source, destination) and not announced:
                                log("ANTICHEAT : archives locales JSON/CSV disponibles dans " + str(destination))
                                announced = True
                        except (OSError, ValueError, TypeError) as exc:
                            log("Archive locale reportée : " + str(exc)[:130])
            except OSError as exc:
                log("ANTICHEAT : dossier inaccessible : " + str(exc)[:120])
            stop_event.wait(5)
    thread = threading.Thread(target=worker, daemon=True, name="VCE-archives-locales")
    thread.start()
    return thread
