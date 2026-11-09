"""Regression tests for VCE 3.7 LMU safe detection; run after patch_v37.py."""
import pathlib
import sys
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "agent"))

import core
import vce_lmu_safe_scan
import vce_lmu_native


class LMUSafeScanTests(unittest.TestCase):
    def test_only_lmu_does_not_enumerate_processes(self):
        with patch.object(core, "_vce_legacy_scan_games37", side_effect=AssertionError("process scan called")):
            with patch.object(core, "lmu_mapping_available", return_value=False):
                result = core.scan_games(only_lmu=True)
                self.assertFalse(result["LMU"]["running"])

    def test_mapping_detected_without_process_enumeration(self):
        with patch.object(core, "_vce_legacy_scan_games37", side_effect=AssertionError("process scan called")):
            with patch.object(core, "lmu_mapping_available", return_value=True):
                result = core.scan_games()
                self.assertTrue(result["LMU"]["running"])
                self.assertFalse(result["AC"]["running"])

    def test_lmu_not_matched_by_process_name(self):
        self.assertEqual(core.GAMES["LMU"]["processes"], ())

    def test_native_mapping_layout(self):
        vce_lmu_native.verify_layout()
        self.assertEqual(vce_lmu_native.FILE_MAP_READ, 4)

    def test_no_game_writes_or_eac_interaction(self):
        scan_source = pathlib.Path(vce_lmu_safe_scan.__file__).read_text(encoding="utf-8")
        native_source = pathlib.Path(vce_lmu_native.__file__).read_text(encoding="utf-8")
        for forbidden in ("WriteProcessMemory(", "OpenProcess(", "CreateRemoteThread(",
                          "SetWindowsHookEx(", "version.dll"):
            self.assertNotIn(forbidden, scan_source + native_source)
        self.assertIn('OpenFileMappingW(FILE_MAP_READ', scan_source)
        self.assertIn('OpenFileMappingW(FILE_MAP_READ', native_source)


if __name__ == "__main__":
    unittest.main()
