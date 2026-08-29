import json
import unittest
from pathlib import Path

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]


class ScreenArtPipelineTest(unittest.TestCase):
    def test_title_screen_uses_the_curated_box_candidate(self) -> None:
        run = ROOT / "assets" / "generated" / "screens" / "title-screen-v2"
        manifest = json.loads((run / "manifest.json").read_text(encoding="utf-8"))
        curation = json.loads((run / "curation-run" / "curation.json").read_text(encoding="utf-8"))

        self.assertEqual(manifest["logical_size"], [480, 270])
        self.assertEqual(manifest["selected_candidate"], "02-box")
        self.assertIn("1", curation["states"]["items"]["pixels"])

        curated = Image.open(run / "curation-run" / "curated" / "02-box.png").convert("RGB")
        final = Image.open(ROOT / "assets" / "screens" / "title-background.png").convert("RGB")
        self.assertEqual(final.size, (480, 270))
        self.assertIsNone(ImageChops.difference(curated, final).getbbox())
        self.assertLessEqual(len(final.getcolors(maxcolors=480 * 270)), 48)

    def test_ending_screen_uses_the_curated_nearest_candidate(self) -> None:
        run = ROOT / "assets" / "generated" / "screens" / "ending-screen-v1"
        manifest = json.loads((run / "manifest.json").read_text(encoding="utf-8"))
        curation = json.loads((run / "curation-run" / "curation.json").read_text(encoding="utf-8"))

        self.assertEqual(manifest["logical_size"], [480, 270])
        self.assertEqual(manifest["selected_candidate"], "01-nearest")
        self.assertEqual(curation["states"]["items"]["selected"], [0])

        curated = Image.open(run / "curation-run" / "curated" / "01-nearest.png").convert("RGB")
        final = Image.open(ROOT / "assets" / "screens" / "ending-background.png").convert("RGB")
        self.assertEqual(final.size, (480, 270))
        self.assertIsNone(ImageChops.difference(curated, final).getbbox())
        self.assertLessEqual(len(final.getcolors(maxcolors=480 * 270)), 36)


if __name__ == "__main__":
    unittest.main()
