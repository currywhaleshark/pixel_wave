from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image


TOOLS = Path(__file__).resolve().parents[1] / "tools"
sys.path.insert(0, str(TOOLS))

from pixel_lint import lint_run  # noqa: E402
from pixel_normalize import normalize_run  # noqa: E402
from pixel_pipeline_common import image_pixels, sha256_file  # noqa: E402


class PixelPipelineTest(unittest.TestCase):
    def make_run(self, root: Path) -> Path:
        run = root / "fixture"
        run.mkdir()
        manifest = {
            "characterId": "fixture",
            "game_input": "sprite-sheet-alpha.png",
            "sprite_sheet_alpha": "sprite-sheet-alpha.png",
            "cell": {
                "width": 2,
                "height": 2,
                "safe_margin_x": 0,
                "safe_margin_y": 0,
            },
            "frame_layout": {
                "sheetWidth": 4,
                "sheetHeight": 2,
                "cellWidth": 2,
                "cellHeight": 2,
                "rows": {
                    "idle": [
                        {"x": 0, "y": 0, "w": 2, "h": 2},
                        {"x": 2, "y": 0, "w": 2, "h": 2},
                    ]
                },
            },
        }
        (run / "manifest.json").write_text(
            json.dumps(manifest, indent=2), encoding="utf-8"
        )
        (run / "palette.lock.json").write_text(
            json.dumps(
                {
                    "kind": "sprite-gen-palette-lock",
                    "colors": [[10, 20, 30], [240, 230, 220]],
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        image = Image.new("RGBA", (4, 2), (9, 19, 31, 200))
        image.putpixel((0, 0), (100, 100, 100, 255))
        image.putpixel((1, 1), (255, 255, 255, 40))
        image.save(run / "sprite-sheet-alpha.png")
        return run

    def test_normalize_is_binary_palette_locked_and_idempotent(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            run = self.make_run(Path(temporary))
            first = normalize_run(run)
            first_hash = sha256_file(run / "sprite-sheet-pixel.png")
            second = normalize_run(run)
            second_hash = sha256_file(run / "sprite-sheet-pixel.png")

            self.assertEqual(first_hash, second_hash)
            self.assertEqual(first["sha256"], second["sha256"])
            with Image.open(run / "sprite-sheet-pixel.png") as image:
                colors = set(image_pixels(image.convert("RGBA")))
            self.assertLessEqual({pixel[3] for pixel in colors}, {0, 255})
            self.assertLessEqual(
                {pixel[:3] for pixel in colors if pixel[3]},
                {(10, 20, 30), (240, 230, 220)},
            )
            self.assertIn((0, 0, 0, 0), colors)

            manifest = json.loads((run / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["game_input"], "sprite-sheet-pixel.png")
            self.assertEqual(manifest["sprite_sheet_alpha"], "sprite-sheet-alpha.png")

    def test_lint_rejects_raw_and_accepts_normalized(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            run = self.make_run(Path(temporary))
            raw = lint_run(run)
            self.assertFalse(raw["ok"])
            self.assertGreater(raw["checks"]["binary_alpha"]["semi_transparent_pixels"], 0)
            self.assertEqual(raw["checks"]["palette"]["foreign_colors"], [[100, 100, 100]])

            normalize_run(run)
            normalized = lint_run(run)
            self.assertTrue(normalized["ok"])
            self.assertEqual(normalized["checks"]["palette"]["foreign_colors"], [])

    def test_lint_can_fail_pitch_warnings_and_shape_contracts(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            run = self.make_run(Path(temporary))
            normalize_run(run)
            request = {
                "pixel_lint": {
                    "fail_on_pitch_warnings": True,
                    "bbox_aspect_ratio": {"min": 1.5, "max": 2.0},
                }
            }
            (run / "sprite-request.json").write_text(
                json.dumps(request, indent=2), encoding="utf-8"
            )
            frames_dir = run / "frames"
            frames_dir.mkdir()
            (frames_dir / "frames-manifest.json").write_text(
                json.dumps(
                    {
                        "warnings": [
                            "idle: pitch crosscheck: axis ratio y/x disagrees (50.0%); one axis may have collapsed"
                        ]
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )

            report = lint_run(run)
            self.assertFalse(report["ok"])
            self.assertFalse(report["checks"]["extraction_pitch"]["ok"])
            self.assertFalse(report["checks"]["silhouette_contract"]["ok"])


if __name__ == "__main__":
    unittest.main()
