#!/usr/bin/env python3
"""Build the Stage 1 seamless native-resolution sea strip from an ImageGen source."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
RUN_DIR = ROOT / "assets" / "generated" / "backgrounds" / "stage1-sea-strip"
SOURCE = RUN_DIR / "sources" / "sea-long-source-v1.png"
RUNTIME = ROOT / "assets" / "backgrounds" / "stage1-sea-strip.png"
GENERATED = RUN_DIR / "sea-strip.png"
TARGET_SIZE = (1440, 270)
SEAM_MARGIN = 64
PALETTE = [
    (97, 204, 212),
    (78, 194, 207),
    (74, 184, 200),
    (62, 175, 196),
    (54, 163, 189),
    (46, 145, 180),
    (38, 127, 168),
    (32, 110, 155),
    (28, 99, 145),
    (24, 88, 132),
]


def blend(left: tuple[int, int, int], right: tuple[int, int, int], ratio: float) -> tuple[int, int, int]:
    return tuple(round(a * (1 - ratio) + b * ratio) for a, b in zip(left, right))


def crop_to_target_aspect(source: Image.Image) -> tuple[Image.Image, list[int]]:
    target_ratio = TARGET_SIZE[0] / TARGET_SIZE[1]
    crop_height = round(source.width / target_ratio)
    if crop_height > source.height:
        crop_width = round(source.height * target_ratio)
        left = (source.width - crop_width) // 2
        box = [left, 0, left + crop_width, source.height]
    else:
        # The generated source reserves its upper half for the complete bright-to-deep water composition.
        box = [0, 0, source.width, crop_height]
    return source.crop(tuple(box)), box


def add_depth_grade(image: Image.Image) -> Image.Image:
    output = Image.new("RGB", image.size)
    source = image.load()
    target = output.load()
    for y in range(image.height):
        depth = y / (image.height - 1)
        factor = 1.0 - depth * 0.22
        for x in range(image.width):
            r, g, b = source[x, y]
            target[x, y] = (round(r * factor), round(g * factor), round(b * factor))
    return output


def repair_wrap_seam(image: Image.Image) -> None:
    pixels = image.load()
    width, height = image.size
    for y in range(height):
        shared = blend(pixels[SEAM_MARGIN, y], pixels[width - 1 - SEAM_MARGIN, y], 0.5)
        for x in range(SEAM_MARGIN):
            ratio = x / SEAM_MARGIN
            pixels[x, y] = blend(shared, pixels[x, y], ratio)
            right_x = width - 1 - x
            pixels[right_x, y] = blend(shared, pixels[right_x, y], ratio)


def nearest_palette(pixel: tuple[int, int, int]) -> tuple[int, int, int]:
    r, g, b = pixel
    return min(PALETTE, key=lambda color: (r - color[0]) ** 2 + (g - color[1]) ** 2 + (b - color[2]) ** 2)


def quantize(image: Image.Image) -> Image.Image:
    output = Image.new("RGBA", image.size, (0, 0, 0, 255))
    output.putdata([(*nearest_palette(pixel), 255) for pixel in image.get_flattened_data()])
    output.paste(output.crop((0, 0, 1, output.height)), (output.width - 1, 0))
    return output


def main() -> None:
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    RUNTIME.parent.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGB")
    cropped, crop_box = crop_to_target_aspect(source)
    normalized = cropped.resize(TARGET_SIZE, Image.Resampling.LANCZOS)
    normalized = add_depth_grade(normalized)
    repair_wrap_seam(normalized)
    output = quantize(normalized)
    output.save(GENERATED)
    output.save(RUNTIME)

    palette_hex = [f"#{r:02x}{g:02x}{b:02x}" for r, g, b in PALETTE]
    manifest = {
        "version": 1,
        "kind": "pixel-wave-sea-strip",
        "stage": "stage1",
        "logical_viewport": [480, 270],
        "source": "sources/sea-long-source-v1.png",
        "source_size": list(source.size),
        "crop_box": crop_box,
        "generated": GENERATED.name,
        "file": "../../../backgrounds/stage1-sea-strip.png",
        "width": output.width,
        "height": output.height,
        "panel_count": 3,
        "runtime_scale": 1,
        "parallax": 0.025,
        "seamless": True,
        "opaque": True,
        "palette": palette_hex,
        "normalization": "aspect-preserving crop, Lanczos concept resample, depth grade, edge bridge, nearest locked palette",
        "generation_prompt": "generation-prompt.md",
    }
    (RUN_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (RUN_DIR / "palette.lock.json").write_text(
        json.dumps({"version": 1, "colors": palette_hex}, indent=2) + "\n", encoding="utf-8"
    )
    print(f"built {RUNTIME.relative_to(ROOT)} ({output.width}x{output.height}, opaque, seamless)")


if __name__ == "__main__":
    main()
