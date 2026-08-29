#!/usr/bin/env python3
"""Create a deterministic limited palette lock from a curated sprite atlas."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

from PIL import Image


def luma(color: tuple[int, int, int]) -> float:
    return color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722


def build_palette(image: Image.Image, size: int) -> list[tuple[int, int, int]]:
    pixels = [pixel[:3] for pixel in image.convert("RGBA").get_flattened_data() if pixel[3] >= 128]
    if not pixels:
        raise ValueError("atlas has no opaque pixels")
    counts = Counter(pixels)
    if len(counts) <= size:
        return sorted(counts, key=lambda color: (luma(color), color))

    sample = Image.new("RGB", (len(pixels), 1))
    sample.putdata(pixels)
    quantized = sample.quantize(
        colors=max(1, size - 2),
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.NONE,
    )
    raw = quantized.getpalette() or []
    used_indices = sorted(set(quantized.get_flattened_data()))
    colors = [(raw[index * 3], raw[index * 3 + 1], raw[index * 3 + 2]) for index in used_indices]

    # Preserve the exact outline and highlight endpoints from the curated artwork.
    colors.extend((min(counts, key=luma), max(counts, key=luma)))
    unique = list(dict.fromkeys(colors))
    if len(unique) < size:
        for color, _count in counts.most_common():
            if color not in unique:
                unique.append(color)
            if len(unique) == size:
                break
    unique = sorted(unique, key=lambda color: (luma(color), color))
    return unique[:size]


def lock_run(run_dir: Path) -> None:
    request = json.loads((run_dir / "sprite-request.json").read_text(encoding="utf-8"))
    size = int(request.get("fit", {}).get("palette_size", 16))
    atlas = Image.open(run_dir / "sprite-sheet-alpha.png").convert("RGBA")
    palette = build_palette(atlas, size)
    payload = {
        "kind": "sprite-gen-palette-lock",
        "source": "curated-atlas:median-cut-v1",
        "colors": [list(color) for color in palette],
    }
    (run_dir / "palette.lock.json").write_text(
        json.dumps(payload, indent=2) + "\n", encoding="utf-8"
    )
    print(f"LOCKED {run_dir.name}: {len(palette)} colors")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_dirs", nargs="+", type=Path)
    args = parser.parse_args()
    for run_dir in args.run_dirs:
        lock_run(run_dir.resolve())


if __name__ == "__main__":
    main()
