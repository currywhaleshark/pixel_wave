#!/usr/bin/env python3
"""Build Stage 2 Jellyfish Meadow sea and terrain strips."""

from __future__ import annotations

import json
import statistics
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


ROOT = Path(__file__).resolve().parents[1]
RUN_DIR = ROOT / "assets" / "generated" / "backgrounds" / "stage2-jelly-meadow"
SOURCE_DIR = RUN_DIR / "sources"
OUT_DIR = ROOT / "assets" / "backgrounds"
STRIP_WIDTH = 1440
PANEL_WIDTH = 480
SEA_SIZE = (1440, 270)
SEA_SEAM_MARGIN = 64
SEA_PALETTE = [
    (138, 121, 220), (117, 101, 203), (98, 86, 183), (81, 70, 159), (67, 56, 135),
    (53, 44, 114), (42, 35, 95), (33, 26, 82), (25, 19, 65), (18, 13, 54),
]
LAYERS = {
    "far": {"height": 48, "parallax": 0.10, "source": "far-long-source-v3.png", "cap_width": 42, "cap_height": 14},
    "mid": {"height": 72, "parallax": 0.30, "source": "mid-long-source-v2.png", "cap_width": 58, "cap_height": 22},
    "near": {"height": 128, "parallax": 0.76, "source": "near-long-source-v2.png", "cap_width": 76, "cap_height": 38},
}


def is_key(pixel: tuple[int, int, int]) -> bool:
    r, g, b = pixel
    return g > 180 and g > r * 1.35 and g > b * 1.25


def remove_key(source: Image.Image) -> Image.Image:
    rgb = source.convert("RGB")
    output = Image.new("RGBA", rgb.size, (0, 0, 0, 0))
    src = rgb.load()
    dst = output.load()
    for y in range(rgb.height):
        for x in range(rgb.width):
            r, g, b = src[x, y]
            if is_key((r, g, b)):
                continue
            if g > max(r, b):
                g = max(r, b)
            dst[x, y] = (r, g, b, 255)
    return output


def locked_terrain_palette() -> list[tuple[int, int, int]]:
    lock_path = RUN_DIR / "palette.lock.json"
    if lock_path.is_file():
        return [tuple(color) for color in json.loads(lock_path.read_text(encoding="utf-8"))["colors"]]
    samples: list[tuple[int, int, int]] = []
    for spec in LAYERS.values():
        keyed = remove_key(Image.open(SOURCE_DIR / spec["source"]))
        samples.extend((r, g, b) for r, g, b, a in keyed.get_flattened_data() if a)
    sampled = samples[:: max(1, len(samples) // 200_000)]
    strip = Image.new("RGB", (len(sampled), 1))
    strip.putdata(sampled)
    quantized = strip.quantize(colors=20, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    raw = quantized.getpalette()[:60]
    colors = sorted(
        {(raw[i], raw[i + 1], raw[i + 2]) for i in range(0, len(raw), 3)},
        key=lambda color: sum(color),
    )
    lock_path.write_text(json.dumps({"version": 1, "colors": colors}, indent=2) + "\n", encoding="utf-8")
    return colors


def nearest(pixel: tuple[int, int, int], colors: list[tuple[int, int, int]]) -> tuple[int, int, int]:
    r, g, b = pixel
    return min(colors, key=lambda color: (r - color[0]) ** 2 + (g - color[1]) ** 2 + (b - color[2]) ** 2)


def repalette(image: Image.Image, colors: list[tuple[int, int, int]]) -> Image.Image:
    output = Image.new("RGBA", image.size, (0, 0, 0, 0))
    output.putdata([(0, 0, 0, 0) if a == 0 else (*nearest((r, g, b), colors), 255) for r, g, b, a in image.get_flattened_data()])
    return output


def fill_underbody(image: Image.Image, dark: tuple[int, int, int]) -> None:
    draw = ImageDraw.Draw(image)
    for x in range(image.width):
        lowest = next((y for y in range(image.height - 1, -1, -1) if image.getpixel((x, y))[3]), None)
        if lowest is None:
            raise ValueError(f"disconnected source: empty column {x}")
        draw.line((x, lowest, x, image.height - 1), fill=(*dark, 255))


def column_top(image: Image.Image, x: int) -> int:
    return next((y for y in range(image.height) if image.getpixel((x, y))[3]), image.height - 1)


def repair_panel_wrap(image: Image.Image, colors: list[tuple[int, int, int]], margin: int = 16) -> None:
    left = round(statistics.median(column_top(image, x) for x in range(margin, margin * 2)))
    right = round(statistics.median(column_top(image, x) for x in range(image.width - margin * 2, image.width - margin)))
    common = round((left + right) / 2)
    draw = ImageDraw.Draw(image)
    for x in range(margin):
        ratio = x / (margin - 1)
        for target_x, top in (
            (x, round(common * (1 - ratio) + left * ratio)),
            (image.width - margin + x, round(right * (1 - ratio) + common * ratio)),
        ):
            draw.line((target_x, 0, target_x, image.height - 1), fill=(0, 0, 0, 0))
            draw.line((target_x, top, target_x, image.height - 1), fill=(*colors[0], 255))
            draw.point((target_x, top), fill=(*colors[1], 255))
    image.paste(image.crop((0, 0, 1, image.height)), (image.width - 1, 0))


def build_seam_cap(panel: Image.Image, width: int, cap_height: int) -> Image.Image:
    """Cut a native-scale meadow clump from the richest part of the generated panel.

    A rounded mask tapers the crop to one pixel at each side, so the overlay hides
    a panel boundary without introducing a second vertical cut of its own.
    """
    half = width // 2
    candidates = range(half, panel.width - half)
    center = max(
        candidates,
        key=lambda x: sum(panel.height - column_top(panel, sx) for sx in range(x - half, x + half)),
    )
    crop = panel.crop((center - half, 0, center - half + width, panel.height))
    cap = Image.new("RGBA", crop.size, (0, 0, 0, 0))
    src = crop.load()
    dst = cap.load()
    for x in range(width):
        normalized = x / max(1, width - 1)
        dome = max(1, round(cap_height * (1 - abs(normalized * 2 - 1) ** 1.65)))
        mask_top = panel.height - dome
        for y in range(mask_top, panel.height):
            if src[x, y][3]:
                dst[x, y] = src[x, y]
    return cap


def paste_wrapped(base: Image.Image, overlay: Image.Image, center_x: int) -> None:
    left = center_x - overlay.width // 2
    for shifted_left in (left - base.width, left, left + base.width):
        dst_left = max(0, shifted_left)
        dst_right = min(base.width, shifted_left + overlay.width)
        if dst_left >= dst_right:
            continue
        src_left = dst_left - shifted_left
        piece = overlay.crop((src_left, 0, src_left + dst_right - dst_left, overlay.height))
        base.alpha_composite(piece, (dst_left, 0))


def build_terrain_layer(name: str, spec: dict, colors: list[tuple[int, int, int]]) -> tuple[Image.Image, dict]:
    source = remove_key(Image.open(SOURCE_DIR / spec["source"]))
    bbox = source.getbbox()
    if bbox is None:
        raise ValueError(f"empty keyed source: {spec['source']}")
    cropped = source.crop(tuple(bbox))
    scaled_height = round(cropped.height * PANEL_WIDTH / cropped.width)
    if scaled_height > spec["height"]:
        raise ValueError(f"{spec['source']}: native height {scaled_height} exceeds {spec['height']}")
    scaled = cropped.resize((PANEL_WIDTH, scaled_height), Image.Resampling.NEAREST)
    scaled = repalette(scaled, colors)
    panel = Image.new("RGBA", (PANEL_WIDTH, spec["height"]), (0, 0, 0, 0))
    panel.alpha_composite(scaled, (0, spec["height"] - scaled_height))
    fill_underbody(panel, colors[0])
    repair_panel_wrap(panel, colors)
    strip = Image.new("RGBA", (STRIP_WIDTH, spec["height"]), (0, 0, 0, 0))
    for index, variant in enumerate((panel, ImageOps.mirror(panel), panel)):
        strip.alpha_composite(variant, (index * PANEL_WIDTH, 0))
    cap = build_seam_cap(panel, spec["cap_width"], spec["cap_height"])
    for seam_x in (0, PANEL_WIDTH, PANEL_WIDTH * 2):
        paste_wrapped(strip, cap, seam_x)
    caps_dir = RUN_DIR / "caps"
    caps_dir.mkdir(parents=True, exist_ok=True)
    cap.save(caps_dir / f"{name}-seam-cap.png")
    strip.paste(strip.crop((0, 0, 1, strip.height)), (strip.width - 1, 0))
    heights = [strip.height - column_top(strip, x) for x in range(strip.width)]
    return strip, {
        "source_size": list(source.size),
        "source_bbox": list(bbox),
        "content_size": [PANEL_WIDTH, scaled_height],
        "height_range": [min(heights), max(heights)],
        "panel_width": PANEL_WIDTH,
        "panel_count": 3,
        "runtime_scale": 1,
        "scale": round(PANEL_WIDTH / cropped.width, 6),
        "aspect_preserved": True,
        "seam_cap": {
            "generated": f"caps/{name}-seam-cap.png",
            "positions": [0, PANEL_WIDTH, PANEL_WIDTH * 2],
            "size": list(cap.size),
            "runtime_scale": 1,
            "source": f"sources/{spec['source']}",
        },
    }


def blend(left: tuple[int, int, int], right: tuple[int, int, int], ratio: float) -> tuple[int, int, int]:
    return tuple(round(a * (1 - ratio) + b * ratio) for a, b in zip(left, right))


def build_sea() -> tuple[Image.Image, dict]:
    source = Image.open(SOURCE_DIR / "sea-long-source-v1.png").convert("RGB")
    crop_height = round(source.width * SEA_SIZE[1] / SEA_SIZE[0])
    crop_box = [0, 0, source.width, crop_height]
    output = source.crop(tuple(crop_box)).resize(SEA_SIZE, Image.Resampling.LANCZOS)
    pixels = output.load()
    for y in range(output.height):
        factor = 1.0 - 0.20 * y / (output.height - 1)
        for x in range(output.width):
            pixels[x, y] = tuple(round(channel * factor) for channel in pixels[x, y])
    for y in range(output.height):
        shared = blend(pixels[SEA_SEAM_MARGIN, y], pixels[output.width - 1 - SEA_SEAM_MARGIN, y], 0.5)
        for x in range(SEA_SEAM_MARGIN):
            ratio = x / SEA_SEAM_MARGIN
            pixels[x, y] = blend(shared, pixels[x, y], ratio)
            right_x = output.width - 1 - x
            pixels[right_x, y] = blend(shared, pixels[right_x, y], ratio)
    rgba = Image.new("RGBA", output.size, (0, 0, 0, 255))
    rgba.putdata([(*nearest(pixel, SEA_PALETTE), 255) for pixel in output.get_flattened_data()])
    rgba.paste(rgba.crop((0, 0, 1, rgba.height)), (rgba.width - 1, 0))
    return rgba, {"source_size": list(source.size), "crop_box": crop_box, "runtime_scale": 1}


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    colors = locked_terrain_palette()
    layers: dict[str, dict] = {}

    sea, sea_metrics = build_sea()
    sea.save(OUT_DIR / "stage2-sea-strip.png")
    sea.save(RUN_DIR / "sea-strip.png")
    layers["sea"] = {
        "file": "../../../backgrounds/stage2-sea-strip.png",
        "generated": "sea-strip.png",
        "source": "sources/sea-long-source-v1.png",
        "width": sea.width,
        "height": sea.height,
        "parallax": 0.02,
        "seamless": True,
        "opaque": True,
        "palette": [f"#{r:02x}{g:02x}{b:02x}" for r, g, b in SEA_PALETTE],
        **sea_metrics,
    }

    for name, spec in LAYERS.items():
        image, metrics = build_terrain_layer(name, spec, colors)
        filename = f"stage2-{name}-strip.png"
        image.save(OUT_DIR / filename)
        image.save(RUN_DIR / f"{name}-strip.png")
        layers[name] = {
            "file": f"../../../backgrounds/{filename}",
            "generated": f"{name}-strip.png",
            "source": f"sources/{spec['source']}",
            "width": image.width,
            "height": image.height,
            "parallax": spec["parallax"],
            "seamless": True,
            **metrics,
        }

    manifest = {
        "version": 1,
        "kind": "pixel-wave-stage-background",
        "stage": "stage2",
        "name": "해파리 초원",
        "logical_viewport": [480, 270],
        "palette": [list(color) for color in colors],
        "layers": layers,
        "runtime_effects": ["violet-light-shafts", "lavender-motes"],
        "prompt_log": "generation-prompts.md",
        "notes": "Terrain sources are redrawn natively shallow. Far, mid and near preserve distinct height ranges; tall landmarks are separated by low clearings.",
    }
    (RUN_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("built Stage 2 sea + far/mid/near strips")


if __name__ == "__main__":
    main()
