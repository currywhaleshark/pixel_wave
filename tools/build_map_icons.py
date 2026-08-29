#!/usr/bin/env python3
"""Reconstruct generated navigation-map emblem sources on native pixel grids."""

from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
RUN_DIR = ROOT / "assets" / "generated" / "map-icons-v1"
RAW_DIR = RUN_DIR / "raw"
CANDIDATES = RUN_DIR / "candidates"
ASSETS = {
    "stage1-coral": (24, 24),
    "stage2-jelly": (24, 24),
    "stage3-current": (24, 24),
    "stage4-trench": (24, 24),
    "stage5-wreck": (24, 24),
    "stage6-storm": (24, 24),
    "stage7-palace-water": (24, 24),
    "home-dragon-palace": (48, 40),
}
VARIANTS = {
    "01-box-10": (Image.Resampling.BOX, 10),
    "02-box-14": (Image.Resampling.BOX, 14),
    "03-lanczos-14": (Image.Resampling.LANCZOS, 14),
}


def is_magenta(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, _ = pixel
    return r > 175 and b > 175 and g < 135 and abs(r - b) < 105


def remove_edge_chroma(image: Image.Image) -> Image.Image:
    """Remove only magenta connected to an outer edge, preserving pink subjects."""
    rgba = image.convert("RGBA")
    if rgba.getextrema()[3][0] < 255:
        alpha = rgba.getchannel("A").point(lambda value: 255 if value >= 128 else 0)
        rgba.putalpha(alpha)
        return rgba

    pixels = rgba.load()
    width, height = rgba.size
    seen: set[tuple[int, int]] = set()
    queue: deque[tuple[int, int]] = deque()
    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))
    while queue:
        x, y = queue.popleft()
        if (x, y) in seen or not is_magenta(pixels[x, y]):
            continue
        seen.add((x, y))
        pixels[x, y] = (0, 0, 0, 0)
        if x > 0:
            queue.append((x - 1, y))
        if x + 1 < width:
            queue.append((x + 1, y))
        if y > 0:
            queue.append((x, y - 1))
        if y + 1 < height:
            queue.append((x, y + 1))
    return rgba


def fit_icon(source: Image.Image, size: tuple[int, int], method: int, colors: int) -> Image.Image:
    bbox = source.getchannel("A").getbbox()
    if not bbox:
        raise ValueError("source has no opaque content")
    cropped = source.crop(bbox)
    margin = 1
    max_width, max_height = size[0] - margin * 2, size[1] - margin * 2
    scale = min(max_width / cropped.width, max_height / cropped.height)
    resized_size = (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale)))
    resized = cropped.resize(resized_size, method)

    alpha = resized.getchannel("A").point(lambda value: 255 if value >= 112 else 0)
    navy = Image.new("RGBA", resized.size, (5, 18, 50, 255))
    navy.alpha_composite(resized)
    quantized = navy.convert("RGB").quantize(
        colors=colors,
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.NONE,
    ).convert("RGBA")
    quantized.putalpha(alpha)

    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    x = (size[0] - resized_size[0]) // 2
    y = (size[1] - resized_size[1]) // 2
    canvas.alpha_composite(quantized, (x, y))
    return canvas


def main() -> None:
    outputs: dict[str, dict[str, str]] = {}
    for asset_id, size in ASSETS.items():
        source_path = RAW_DIR / f"{asset_id}.png"
        source = remove_edge_chroma(Image.open(source_path))
        group = CANDIDATES / asset_id
        group.mkdir(parents=True, exist_ok=True)
        outputs[asset_id] = {}
        for variant, (method, colors) in VARIANTS.items():
            output = group / f"{variant}.png"
            fit_icon(source, size, method, colors).save(output)
            outputs[asset_id][variant] = str(output.relative_to(ROOT)).replace("\\", "/")

    (RUN_DIR / "manifest.json").write_text(
        json.dumps(
            {
                "version": 1,
                "kind": "pixel-wave-map-icon-candidates",
                "stage_icon_size": [24, 24],
                "home_size": [48, 40],
                "default_variant": "02-box-14",
                "assets": outputs,
                "curation": "curation-run/curation.json",
                "game_outputs": {
                    "stage_icons": "../../stage-icons.png",
                    "home": "../../map-home.png",
                },
            },
            ensure_ascii=False,
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )
    print(f"built {len(ASSETS)} map assets with {len(VARIANTS)} candidates each")


if __name__ == "__main__":
    main()
