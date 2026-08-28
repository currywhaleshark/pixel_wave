from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from background_lint import lint, lint_sea, lint_stage2  # noqa: E402


class BackgroundPipelineTest(unittest.TestCase):
    def setUp(self) -> None:
        self.run = ROOT / "assets" / "generated" / "backgrounds" / "stage1-coral-strips"

    def test_stage1_background_passes_lint(self) -> None:
        self.assertEqual(lint(self.run), [])

    def test_stage1_generated_sea_passes_lint(self) -> None:
        sea_run = ROOT / "assets" / "generated" / "backgrounds" / "stage1-sea-strip"
        self.assertEqual(lint_sea(sea_run), [])
        manifest = json.loads((sea_run / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual((manifest["width"], manifest["height"]), (1440, 270))
        self.assertEqual(manifest["panel_count"], 3)
        self.assertEqual(manifest["runtime_scale"], 1)
        self.assertTrue(manifest["seamless"])
        self.assertTrue(manifest["opaque"])

    def test_stage1_manifest_has_three_screen_depth_strips(self) -> None:
        manifest = json.loads((self.run / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["logical_viewport"], [480, 270])
        self.assertEqual(list(manifest["layers"]), ["far", "mid", "near"])
        self.assertTrue(all(layer["width"] == 1440 for layer in manifest["layers"].values()))
        self.assertEqual([layer["height"] for layer in manifest["layers"].values()], [24, 36, 128])
        self.assertTrue(all(layer["seamless"] for layer in manifest["layers"].values()))
        self.assertTrue(all(layer["aspect_preserved"] for layer in manifest["layers"].values()))
        self.assertTrue(all(layer["panel_width"] == 480 for layer in manifest["layers"].values()))
        self.assertTrue(all(layer["runtime_scale"] == 1 for layer in manifest["layers"].values()))
        for layer in manifest["layers"].values():
            self.assertEqual(layer["seam_cap"]["positions"], [0, 480, 960])
            self.assertEqual(layer["seam_cap"]["runtime_scale"], 1)
        self.assertEqual(
            [(layer["seam_cap"]["state"], layer["seam_cap"]["frame"]) for layer in manifest["layers"].values()],
            [("far_reef", 2), ("mid_reef", 0), ("far_reef", 1)],
        )
        clumps = manifest["layers"]["near"]["decor_clumps"]
        self.assertEqual(len(clumps), 3)
        self.assertTrue(all(clump["runtime_scale"] == 1 for clump in clumps))
        towers = manifest["layers"]["near"]["tower_clumps"]
        self.assertEqual([tower["label"] for tower in towers], ["2.5x", "3x"])
        self.assertEqual([tower["center_x"] for tower in towers], [340, 1085])
        self.assertEqual([tower["frame"] for tower in towers], [0, 1])
        self.assertTrue(all(tower["state"] == "tower_reef" for tower in towers))
        self.assertTrue(all(tower["runtime_scale"] == 1 for tower in towers))
        speeds = [layer["parallax"] for layer in manifest["layers"].values()]
        self.assertEqual(speeds, sorted(speeds))

    def test_large_reef_landmarks_are_native_single_frames(self) -> None:
        frames = ROOT / "assets" / "generated" / "backgrounds" / "stage1-coral-towers" / "frames" / "tower_reef"
        heights = []
        for index in range(2):
            image = Image.open(frames / f"frame-{index}.png").convert("RGBA")
            self.assertEqual(image.size, (144, 128))
            bbox = image.getbbox()
            self.assertIsNotNone(bbox)
            heights.append(bbox[3] - bbox[1])
        self.assertGreaterEqual(heights[0], 80)
        self.assertGreaterEqual(heights[1], 105)
        self.assertLessEqual(heights[0], 95)
        self.assertLessEqual(heights[1], 120)

    def test_stage2_meadow_preserves_layered_height_variation(self) -> None:
        run = ROOT / "assets" / "generated" / "backgrounds" / "stage2-jelly-meadow"
        self.assertEqual(lint_stage2(run), [])
        manifest = json.loads((run / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(list(manifest["layers"]), ["sea", "far", "mid", "near"])
        self.assertEqual([manifest["layers"][name]["height"] for name in ("sea", "far", "mid", "near")], [270, 48, 72, 128])
        self.assertEqual([manifest["layers"][name]["height_range"] for name in ("far", "mid", "near")], [[6, 39], [11, 62], [24, 124]])
        self.assertTrue(all(manifest["layers"][name]["runtime_scale"] == 1 for name in manifest["layers"]))
        self.assertTrue(all(manifest["layers"][name]["seamless"] for name in manifest["layers"]))
        for name in ("far", "mid", "near"):
            cap = manifest["layers"][name]["seam_cap"]
            self.assertEqual(cap["positions"], [0, 480, 960])
            self.assertEqual(cap["runtime_scale"], 1)
            self.assertTrue((run / cap["generated"]).is_file())

    def test_stage3_highway_is_connected_and_height_varied(self) -> None:
        run = ROOT / "assets" / "generated" / "backgrounds" / "stage3-turtle-highway"
        self.assertEqual(lint_stage2(run), [])
        manifest = json.loads((run / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(list(manifest["layers"]), ["sea", "far", "mid", "near"])
        self.assertEqual(
            [manifest["layers"][name]["height"] for name in ("sea", "far", "mid", "near")],
            [270, 56, 72, 128],
        )
        self.assertGreaterEqual(manifest["layers"]["near"]["height_range"][1], 90)
        self.assertLessEqual(manifest["layers"]["near"]["height_range"][0], 20)
        for name in ("far", "mid", "near"):
            layer = manifest["layers"][name]
            self.assertTrue(layer["aspect_preserved"])
            self.assertEqual(layer["runtime_scale"], 1)
            self.assertEqual(layer["seam_cap"]["positions"], [0, 480, 960])
            self.assertTrue((run / layer["seam_cap"]["generated"]).is_file())


if __name__ == "__main__":
    unittest.main()
