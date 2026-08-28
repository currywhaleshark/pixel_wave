from __future__ import annotations

import json
import unittest
from pathlib import Path

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]


class Stage2SpritePipelineTest(unittest.TestCase):
    def assert_packed_run(
        self,
        run_name: str,
        state: str,
        sheet_name: str,
        position: tuple[int, int],
        cell: tuple[int, int],
    ) -> None:
        run = ROOT / "assets" / "generated" / "sprites" / run_name
        manifest = json.loads((run / "manifest.json").read_text(encoding="utf-8"))
        lint = json.loads((run / "pixel-lint.report.json").read_text(encoding="utf-8"))
        self.assertTrue(lint["ok"])
        self.assertEqual(len(manifest["frame_layout"]["rows"][state]), 2)

        source = Image.open(run / manifest["game_input"]).convert("RGBA")
        sheet = Image.open(ROOT / "assets" / sheet_name).convert("RGBA")
        width, height = cell
        x, y = position
        packed = sheet.crop((x, y, x + width * 2, y + height))
        self.assertIsNone(ImageChops.difference(source, packed).getbbox())

    def test_lantern_and_mongsil_are_normalized_and_packed(self) -> None:
        self.assert_packed_run("enemy-lantern", "float", "sprites.png", (0, 64), (18, 24))
        self.assert_packed_run("mongsil", "idle", "bosses.png", (96, 0), (48, 56))


if __name__ == "__main__":
    unittest.main()
