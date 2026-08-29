#!/usr/bin/env python3
"""Build deterministic 480x270 navigation-map background candidates."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
RUN_DIR = ROOT / "assets" / "generated" / "screens" / "map-screen-v1"
SOURCE = RUN_DIR / "source" / "map-concept-v1.png"
CANDIDATES = RUN_DIR / "candidates"
TARGET_SIZE = (480, 270)
COLOR_COUNT = 32


def palette_from(image: Image.Image) -> tuple[Image.Image, list[list[int]]]:
    quantized = image.quantize(
        colors=COLOR_COUNT,
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.NONE,
    )
    raw = quantized.getpalette()[: COLOR_COUNT * 3]
    colors = [tuple(raw[index:index + 3]) for index in range(0, len(raw), 3)]
    flat = [channel for color in colors for channel in color]
    palette = Image.new("P", (1, 1))
    palette.putpalette(flat + [0] * (768 - len(flat)))
    return palette, [list(color) for color in colors]


def main() -> None:
    CANDIDATES.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGB")
    fitted = {
        "01-nearest": ImageOps.fit(source, TARGET_SIZE, method=Image.Resampling.NEAREST),
        "02-box": ImageOps.fit(source, TARGET_SIZE, method=Image.Resampling.BOX),
        "03-lanczos": ImageOps.fit(source, TARGET_SIZE, method=Image.Resampling.LANCZOS),
    }
    palette, colors = palette_from(fitted["02-box"])

    outputs: dict[str, str] = {}
    for name, image in fitted.items():
        normalized = image.quantize(palette=palette, dither=Image.Dither.NONE).convert("RGB")
        path = CANDIDATES / f"{name}.png"
        normalized.save(path)
        outputs[name] = str(path.relative_to(ROOT)).replace("\\", "/")

    (RUN_DIR / "palette.lock.json").write_text(
        json.dumps({"version": 1, "colors": colors}, indent=2) + "\n",
        encoding="utf-8",
    )
    (RUN_DIR / "manifest.json").write_text(
        json.dumps(
            {
                "version": 1,
                "kind": "pixel-wave-screen-candidates",
                "screen": "navigation-map",
                "logical_size": list(TARGET_SIZE),
                "source": str(SOURCE.relative_to(ROOT)).replace("\\", "/"),
                "palette_size": len(colors),
                "candidates": outputs,
                "curation": "curation-run/curation.json",
                "selected_candidate": "02-box",
                "game_input": "../../../screens/map-background.png",
            },
            ensure_ascii=False,
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )
    print(f"built {len(outputs)} map candidates at {TARGET_SIZE[0]}x{TARGET_SIZE[1]}")


if __name__ == "__main__":
    main()
