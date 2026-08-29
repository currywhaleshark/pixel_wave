import json
import unittest
from pathlib import Path

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]


class DolphinSpritePipelineTest(unittest.TestCase):
    PLACEMENTS = {
        "homing": (0, 24),
        "burst": (36, 24),
        "pierce": (72, 24),
    }

    def test_curated_dolphins_are_normalized_and_packed(self) -> None:
        packed = Image.open(ROOT / "assets" / "sprites.png").convert("RGBA")

        for dolphin, (x, y) in self.PLACEMENTS.items():
            with self.subTest(dolphin=dolphin):
                run = ROOT / "assets" / "generated" / "sprites" / f"dolphin-{dolphin}"
                manifest = json.loads((run / "manifest.json").read_text(encoding="utf-8"))
                lint = json.loads((run / "pixel-lint.report.json").read_text(encoding="utf-8"))

                self.assertTrue(manifest["curation_applied"])
                self.assertTrue(lint["ok"])
                self.assertEqual(manifest["cell"]["width"], 18)
                self.assertEqual(manifest["cell"]["height"], 10)
                self.assertEqual(len(manifest["frame_layout"]["rows"]["swim"]), 2)

                source = Image.open(run / manifest["game_input"]).convert("RGBA")
                crop = packed.crop((x, y, x + 36, y + 10))
                self.assertIsNone(ImageChops.difference(source, crop).getbbox())


if __name__ == "__main__":
    unittest.main()
