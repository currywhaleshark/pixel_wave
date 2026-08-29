import json
import unittest
from pathlib import Path

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]


class MapArtPipelineTest(unittest.TestCase):
    def test_map_background_matches_curated_selection(self) -> None:
        run = ROOT / "assets" / "generated" / "screens" / "map-screen-v1"
        curation = json.loads((run / "curation-run" / "curation.json").read_text(encoding="utf-8"))
        self.assertEqual(curation["states"]["items"]["selected"], [1])

        curated = Image.open(run / "curation-run" / "curated" / "02-box.png").convert("RGB")
        final = Image.open(ROOT / "assets" / "screens" / "map-background.png").convert("RGB")
        self.assertEqual(final.size, (480, 270))
        self.assertIsNone(ImageChops.difference(curated, final).getbbox())
        self.assertLessEqual(len(final.getcolors(maxcolors=480 * 270)), 32)

    def test_map_icons_and_home_are_native_binary_alpha_assets(self) -> None:
        atlas = Image.open(ROOT / "assets" / "stage-icons.png").convert("RGBA")
        home = Image.open(ROOT / "assets" / "map-home.png").convert("RGBA")
        self.assertEqual(atlas.size, (168, 24))
        self.assertEqual(home.size, (48, 40))
        self.assertTrue(set(atlas.getchannel("A").get_flattened_data()).issubset({0, 255}))
        self.assertTrue(set(home.getchannel("A").get_flattened_data()).issubset({0, 255}))
        for index in range(7):
            frame = atlas.crop((index * 24, 0, (index + 1) * 24, 24))
            self.assertIsNotNone(frame.getchannel("A").getbbox())

    def test_runtime_enables_all_map_art(self) -> None:
        assets = (ROOT / "js" / "assets.js").read_text(encoding="utf-8")
        map_js = (ROOT / "js" / "map.js").read_text(encoding="utf-8")
        self.assertIn("'screen.map': 'assets/screens/map-background.png?v=1'", assets)
        self.assertIn("'map.home': 'assets/map-home.png?v=1'", assets)
        self.assertIn("w: 24, h: 24, frames: 1, fps: 0, ax: 12, ay: 12, on: true", assets)
        self.assertIn("Sprites.draw(ctx, 'map.home'", map_js)
        self.assertIn("Assets.image('screen.map')", map_js)


if __name__ == "__main__":
    unittest.main()
