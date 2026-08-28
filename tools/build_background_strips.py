#!/usr/bin/env python3
"""Build seamless Stage 1 strips from ultra-wide ImageGen reef sources."""

from __future__ import annotations

import json
import statistics
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


ROOT = Path(__file__).resolve().parents[1]
PATCH_RUN = ROOT / "assets" / "generated" / "backgrounds" / "stage1-coral-patches"
TOWER_RUN = ROOT / "assets" / "generated" / "backgrounds" / "stage1-coral-towers"
RUN_DIR = ROOT / "assets" / "generated" / "backgrounds" / "stage1-coral-strips"
SOURCE_DIR = RUN_DIR / "sources"
OUT_DIR = ROOT / "assets" / "backgrounds"
STRIP_WIDTH = 1440
PANEL_WIDTH = 480
PANEL_COUNT = 3
SEAM_POSITIONS = (0, 480, 960)
DECOR_CLUMPS = (
    ("far_reef", 2, 145, False),
    ("far_reef", 0, 625, False),
    ("far_reef", 2, 1305, True),
)
TOWER_CLUMPS = (
    ("2.5x", 0, 340, False),
    ("3x", 1, 1085, True),
)

LAYERS = {
    "far": {
        "height": 24,
        "parallax": 0.14,
        "source": "far-long-source-v2.png",
        "seam_cap": ("far_reef", 2),
    },
    "mid": {
        "height": 36,
        "parallax": 0.38,
        "source": "mid-long-source-v2.png",
        "seam_cap": ("mid_reef", 0),
    },
    "near": {
        "height": 128,
        "parallax": 0.82,
        "source": "near-long-source-v2.png",
        "seam_cap": ("far_reef", 1),
    },
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


def nearest_palette(pixel: tuple[int, int, int, int], colors: list[tuple[int, int, int]]) -> tuple[int, int, int, int]:
    if pixel[3] == 0:
        return 0, 0, 0, 0
    r, g, b, _ = pixel
    color = min(colors, key=lambda item: (r - item[0]) ** 2 + (g - item[1]) ** 2 + (b - item[2]) ** 2)
    return color[0], color[1], color[2], 255


def repalette(image: Image.Image, colors: list[tuple[int, int, int]]) -> Image.Image:
    output = Image.new("RGBA", image.size, (0, 0, 0, 0))
    output.putdata([nearest_palette(pixel, colors) for pixel in image.get_flattened_data()])
    return output


def column_top(image: Image.Image, x: int) -> int:
    for y in range(image.height):
        if image.getpixel((x, y))[3]:
            return y
    return image.height - 1


def fill_underbody(image: Image.Image, colors: list[tuple[int, int, int]]) -> None:
    """Extend the lowest rock pixel to the canvas floor in every column."""
    dark = (*colors[0], 255)
    draw = ImageDraw.Draw(image)
    for x in range(image.width):
        lowest = None
        for y in range(image.height - 1, -1, -1):
            if image.getpixel((x, y))[3]:
                lowest = y
                break
        if lowest is None:
            raise ValueError(f"disconnected source: empty column {x}")
        draw.line((x, lowest, x, image.height - 1), fill=dark)


def median_top(image: Image.Image, start: int, end: int) -> int:
    return round(statistics.median(column_top(image, x) for x in range(start, end)))


def repair_wrap_seam(image: Image.Image, colors: list[tuple[int, int, int]], margin: int = 40) -> None:
    """Replace both extreme edges with one matching low reef bridge."""
    dark = (*colors[0], 255)
    ridge = (*colors[1], 255)
    left_inner = median_top(image, margin, margin * 2)
    right_inner = median_top(image, image.width - margin * 2, image.width - margin)
    common = round((left_inner + right_inner) / 2)
    draw = ImageDraw.Draw(image)

    for x in range(margin):
        ratio = x / (margin - 1)
        left_top = round(common * (1 - ratio) + left_inner * ratio)
        right_top = round(right_inner * (1 - ratio) + common * ratio)
        for column_x, top in ((x, left_top), (image.width - margin + x, right_top)):
            draw.line((column_x, 0, column_x, image.height - 1), fill=(0, 0, 0, 0))
            draw.line((column_x, top, column_x, image.height - 1), fill=dark)
            draw.point((column_x, top), fill=ridge)

    image.paste(image.crop((0, 0, 1, image.height)), (image.width - 1, 0))


def paste_wrapped(image: Image.Image, sprite: Image.Image, center_x: int, baseline_lift: int = 0) -> None:
    bbox = sprite.getbbox()
    if bbox is None:
        raise ValueError("empty seam cap")
    x = center_x - (bbox[0] + bbox[2]) // 2
    y = image.height - bbox[3] - baseline_lift
    for wrap in (-image.width, 0, image.width):
        position = (x + wrap, y)
        image.paste(sprite, position, sprite)


def build_layer(spec: dict, colors: list[tuple[int, int, int]]) -> tuple[Image.Image, dict]:
    source_path = SOURCE_DIR / spec["source"]
    keyed = remove_key(Image.open(source_path))
    bbox = keyed.getbbox()
    if bbox is None:
        raise ValueError(f"empty keyed source: {source_path}")
    cropped = keyed.crop((0, bbox[1], keyed.width, bbox[3]))
    scaled_height = round(cropped.height * PANEL_WIDTH / cropped.width)
    if scaled_height > spec["height"]:
        raise ValueError(
            f"{source_path.name}: aspect-preserving height {scaled_height} exceeds canvas {spec['height']}"
        )
    scaled = cropped.resize((PANEL_WIDTH, scaled_height), Image.Resampling.NEAREST)
    scaled = repalette(scaled, colors)
    panel = Image.new("RGBA", (PANEL_WIDTH, spec["height"]), (0, 0, 0, 0))
    panel.alpha_composite(scaled, (0, spec["height"] - scaled_height))
    fill_underbody(panel, colors)
    repair_wrap_seam(panel, colors, margin=16)
    variants = [panel, ImageOps.mirror(panel), panel]
    strip = Image.new("RGBA", (STRIP_WIDTH, spec["height"]), (0, 0, 0, 0))
    for index, variant in enumerate(variants):
        strip.alpha_composite(variant, (index * PANEL_WIDTH, 0))
    seam_state, seam_index = spec["seam_cap"]
    cap = Image.open(PATCH_RUN / "frames" / seam_state / f"frame-{seam_index}.png").convert("RGBA")
    cap = repalette(cap, colors)
    for center_x in SEAM_POSITIONS:
        paste_wrapped(strip, cap, center_x)
    if spec["parallax"] == LAYERS["near"]["parallax"]:
        for state, index, center_x, mirror in DECOR_CLUMPS:
            clump = Image.open(PATCH_RUN / "frames" / state / f"frame-{index}.png").convert("RGBA")
            paste_wrapped(strip, ImageOps.mirror(clump) if mirror else clump, center_x)
        for label, index, center_x, mirror in TOWER_CLUMPS:
            clump = Image.open(TOWER_RUN / "frames" / "tower_reef" / f"frame-{index}.png").convert("RGBA")
            clump = repalette(clump, colors)
            paste_wrapped(strip, ImageOps.mirror(clump) if mirror else clump, center_x)
    strip.paste(strip.crop((0, 0, 1, strip.height)), (strip.width - 1, 0))
    metrics = {
        "source_size": [keyed.width, keyed.height],
        "source_bbox": list(bbox),
        "content_size": [PANEL_WIDTH, scaled_height],
        "panel_width": PANEL_WIDTH,
        "panel_count": PANEL_COUNT,
        "runtime_scale": 1,
        "scale": round(PANEL_WIDTH / cropped.width, 6),
        "aspect_preserved": True,
        "seam_cap": {
            "source": f"../stage1-coral-patches/frames/{seam_state}/frame-{seam_index}.png",
            "state": seam_state,
            "frame": seam_index,
            "positions": list(SEAM_POSITIONS),
            "runtime_scale": 1,
        },
    }
    if spec["parallax"] == LAYERS["near"]["parallax"]:
        metrics["decor_clumps"] = [
            {"state": state, "frame": index, "x": center_x, "mirrored": mirror, "runtime_scale": 1}
            for state, index, center_x, mirror in DECOR_CLUMPS
        ]
        metrics["tower_clumps"] = [
            {
                "label": label,
                "source": f"../stage1-coral-towers/frames/tower_reef/frame-{index}.png",
                "state": "tower_reef",
                "frame": index,
                "center_x": center_x,
                "mirrored": mirror,
                "runtime_scale": 1,
            }
            for label, index, center_x, mirror in TOWER_CLUMPS
        ]
    return strip, metrics


def main() -> None:
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    raw_palette = json.loads((PATCH_RUN / "palette.lock.json").read_text(encoding="utf-8"))["colors"]
    colors = [tuple(color) for color in raw_palette]
    outputs: dict[str, dict] = {}
    for name, spec in LAYERS.items():
        image, metrics = build_layer(spec, colors)
        runtime = OUT_DIR / f"stage1-{name}-strip.png"
        generated = RUN_DIR / f"{name}-strip.png"
        image.save(runtime)
        image.save(generated)
        outputs[name] = {
            "file": f"../../../backgrounds/{runtime.name}",
            "generated": generated.name,
            "source": f"sources/{spec['source']}",
            "width": image.width,
            "height": image.height,
            "parallax": spec["parallax"],
            "seamless": True,
            **metrics,
        }

    manifest = {
        "version": 2,
        "kind": "pixel-wave-background-strips",
        "stage": "stage1",
        "name": "산호 초입",
        "logical_viewport": [480, 270],
        "generation": "built-in ImageGen ultra-wide continuous reef sources",
        "prompt_log": "generation-prompts.md",
        "palette": raw_palette,
        "layers": outputs,
        "runtime_effects": ["water-bands", "light-shafts", "motes"],
        "notes": "Every generated panorama is normalized to one native 480px viewport panel. Three seamless variants form a 1440px strip, drawn at runtime scale 1. Large foreground landmarks are single-piece native extracted frames, never enlarged or stacked.",
    }
    (RUN_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (RUN_DIR / "palette.lock.json").write_text(
        json.dumps({"version": 1, "colors": raw_palette}, indent=2) + "\n", encoding="utf-8"
    )
    print(
        "built "
        + ", ".join(
            f"stage1-{name}-strip.png ({STRIP_WIDTH}x{spec['height']}, no vertical squeeze)"
            for name, spec in LAYERS.items()
        )
    )


if __name__ == "__main__":
    main()
