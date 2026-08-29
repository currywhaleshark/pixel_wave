from __future__ import annotations

import json
import unittest
from pathlib import Path

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]


class Stage5SpritePipelineTest(unittest.TestCase):
    def assert_packed_run(
        self,
        run_name: str,
        state: str,
        sheet_name: str,
        position: tuple[int, int],
        cell: tuple[int, int],
        frames: int,
    ) -> None:
        run = ROOT / "assets" / "generated" / "sprites" / run_name
        manifest = json.loads((run / "manifest.json").read_text(encoding="utf-8"))
        lint = json.loads((run / "pixel-lint.report.json").read_text(encoding="utf-8"))
        self.assertTrue(manifest["curation_applied"])
        self.assertTrue(lint["ok"])
        self.assertEqual(len(manifest["frame_layout"]["rows"][state]), frames)

        source = Image.open(run / manifest["game_input"]).convert("RGBA")
        sheet = Image.open(ROOT / "assets" / sheet_name).convert("RGBA")
        width, height = cell
        x, y = position
        packed = sheet.crop((x, y, x + width * frames, y + height))
        self.assertIsNone(ImageChops.difference(source, packed).getbbox())

    def test_stage5_sprites_and_hull_are_curated_normalized_and_packed(self) -> None:
        self.assert_packed_run("enemy-ghost", "float", "sprites.png", (76, 64), (14, 12), 2)
        self.assert_packed_run("enemy-wreck", "variants", "sprites.png", (64, 96), (40, 32), 4)
        self.assert_packed_run("buu", "idle", "bosses.png", (0, 128), (40, 32), 2)
        self.assert_packed_run(
            "buu-hull", "idle", "backgrounds/stage5-buu-hull.png", (0, 0), (64, 250), 1
        )


if __name__ == "__main__":
    unittest.main()
