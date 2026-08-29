import json
import unittest
from pathlib import Path

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]


class Stage7SpritePipelineTest(unittest.TestCase):
    def test_hwii_is_normalized_packed_and_keeps_the_eye_socket_transparent(self) -> None:
        run = ROOT / "assets" / "generated" / "sprites" / "hwii"
        manifest = json.loads((run / "manifest.json").read_text(encoding="utf-8"))
        lint = json.loads((run / "pixel-lint.report.json").read_text(encoding="utf-8"))

        self.assertTrue(lint["ok"])
        self.assertEqual(manifest["cell"]["width"], 64)
        self.assertEqual(manifest["cell"]["height"], 64)
        self.assertEqual(len(manifest["frame_layout"]["rows"]["idle"]), 4)

        source = Image.open(run / manifest["game_input"]).convert("RGBA")
        packed = Image.open(ROOT / "assets" / "boss-hwii.png").convert("RGBA")
        self.assertEqual(packed.size, (256, 64))
        self.assertIsNone(ImageChops.difference(source, packed).getbbox())

        center_alpha = [source.getpixel((index * 64 + 32, 32))[3] for index in range(4)]
        self.assertEqual(center_alpha, [0, 0, 255, 0])

    def test_hwii_arm_uses_curated_pixel_frames_and_is_packed_separately(self) -> None:
        run = ROOT / "assets" / "generated" / "sprites" / "hwii-arm"
        manifest = json.loads((run / "manifest.json").read_text(encoding="utf-8"))
        lint = json.loads((run / "pixel-lint.report.json").read_text(encoding="utf-8"))

        self.assertTrue(lint["ok"])
        self.assertTrue(manifest["curation_applied"])
        self.assertEqual(manifest["cell"]["width"], 72)
        self.assertEqual(manifest["cell"]["height"], 40)
        self.assertEqual(len(manifest["frame_layout"]["rows"]["flow"]), 2)

        source = Image.open(run / manifest["game_input"]).convert("RGBA")
        packed = Image.open(ROOT / "assets" / "boss-hwii-arm.png").convert("RGBA")
        self.assertEqual(packed.size, (144, 40))
        self.assertIsNone(ImageChops.difference(source, packed).getbbox())


if __name__ == "__main__":
    unittest.main()
