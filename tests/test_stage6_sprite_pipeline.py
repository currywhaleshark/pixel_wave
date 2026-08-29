import json
import unittest
from pathlib import Path

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]


class Stage6SpritePipelineTest(unittest.TestCase):
    def test_ureu_is_curated_normalized_and_packed_as_full_body(self) -> None:
        run = ROOT / "assets" / "generated" / "sprites" / "ureu"
        manifest = json.loads((run / "manifest.json").read_text(encoding="utf-8"))
        lint = json.loads((run / "pixel-lint.report.json").read_text(encoding="utf-8"))

        self.assertTrue(manifest["curation_applied"])
        self.assertTrue(lint["ok"])
        self.assertEqual(manifest["cell"]["width"], 48)
        self.assertEqual(manifest["cell"]["height"], 128)
        self.assertEqual(len(manifest["frame_layout"]["rows"]["idle"]), 4)

        source = Image.open(run / manifest["game_input"]).convert("RGBA")
        packed = Image.open(ROOT / "assets" / "boss-ureu.png").convert("RGBA")
        self.assertEqual(packed.size, (192, 128))
        self.assertIsNone(ImageChops.difference(source, packed).getbbox())


if __name__ == "__main__":
    unittest.main()
