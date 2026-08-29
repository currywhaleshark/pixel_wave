#!/usr/bin/env python3
"""Build Stage 5 Shipwreck Graveyard sea and connected parallax strips."""

from __future__ import annotations

import json
import statistics
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


ROOT = Path(__file__).resolve().parents[1]
RUN_DIR = ROOT / "assets" / "generated" / "backgrounds" / "stage5-wreck-graveyard"
SOURCE_DIR = RUN_DIR / "sources"
OUT_DIR = ROOT / "assets" / "backgrounds"
STRIP_WIDTH = 1440
PANEL_WIDTH = 480
SEA_SIZE = (1440, 270)
SEA_SEAM_MARGIN = 64

SEA_PALETTE = [
    (25, 79, 91), (20, 68, 82), (16, 57, 72), (13, 48, 64),
    (10, 39, 55), (8, 31, 46), (6, 24, 38), (5, 19, 32),
    (4, 15, 26), (3, 11, 22),
]
TERRAIN_PALETTE = [
    (3, 11, 17), (5, 18, 25), (7, 27, 35), (10, 38, 45),
    (13, 51, 56), (18, 65, 67), (25, 81, 78), (35, 98, 89),
    (49, 116, 101), (68, 134, 112), (90, 151, 127),
    (38, 43, 45), (55, 56, 52), (73, 69, 59), (92, 83, 67),
    (113, 100, 78),
]
LAYERS = {
    "far": {"height": 80, "parallax": 0.09, "source": "far-long-source-v1.png", "cap_width": 46, "cap_height": 14},
    "mid": {"height": 160, "parallax": 0.28, "source": "mid-long-source-v1.png", "cap_width": 62, "cap_height": 26},
    "near": {"height": 160, "parallax": 0.76, "source": "near-long-source-v1.png", "cap_width": 88, "cap_height": 46},
}


def nearest(pixel: tuple[int, int, int], palette: list[tuple[int, int, int]]) -> tuple[int, int, int]:
    r, g, b = pixel
    return min(palette, key=lambda c: (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2)


def load_subject(path: Path) -> Image.Image:
    """Load generated terrain and force a deterministic binary alpha channel."""
    source = Image.open(path).convert("RGBA")
    has_transparency = source.getchannel("A").getextrema()[0] < 255
    output = Image.new("RGBA", source.size, (0, 0, 0, 0))
    src = source.load()
    dst = output.load()
    for y in range(source.height):
        for x in range(source.width):
            r, g, b, a = src[x, y]
            if has_transparency:
                if a < 128:
                    continue
            elif r >= 220 and g >= 220 and b >= 220:
                continue
            dst[x, y] = (r, g, b, 255)
    return output


def repalette(image: Image.Image, palette: list[tuple[int, int, int]]) -> Image.Image:
    output = Image.new("RGBA", image.size, (0, 0, 0, 0))
    output.putdata([
        (0, 0, 0, 0) if a == 0 else (*nearest((r, g, b), palette), 255)
        for r, g, b, a in image.get_flattened_data()
    ])
    return output


def column_top(image: Image.Image, x: int) -> int:
    return next((y for y in range(image.height) if image.getpixel((x, y))[3]), image.height - 1)


def fill_underbody(image: Image.Image, dark: tuple[int, int, int]) -> None:
    draw = ImageDraw.Draw(image)
    for x in range(image.width):
        lowest = next((y for y in range(image.height - 1, -1, -1) if image.getpixel((x, y))[3]), None)
        if lowest is None:
            raise ValueError(f"terrain source has an empty column at {x}")
        draw.line((x, lowest, x, image.height - 1), fill=(*dark, 255))


def repair_wrap(image: Image.Image, palette: list[tuple[int, int, int]], margin: int = 18) -> None:
    left = round(statistics.median(column_top(image, x) for x in range(margin, margin * 2)))
    right = round(statistics.median(column_top(image, x) for x in range(image.width - margin * 2, image.width - margin)))
    common = round((left + right) / 2)
    draw = ImageDraw.Draw(image)
    for x in range(margin):
        ratio = x / max(1, margin - 1)
        for target_x, top in (
            (x, round(common * (1 - ratio) + left * ratio)),
            (image.width - margin + x, round(right * (1 - ratio) + common * ratio)),
        ):
            draw.line((target_x, 0, target_x, image.height - 1), fill=(0, 0, 0, 0))
            draw.line((target_x, top, target_x, image.height - 1), fill=(*palette[0], 255))
            draw.point((target_x, top), fill=(*palette[5], 255))
    image.paste(image.crop((0, 0, 1, image.height)), (image.width - 1, 0))


def build_cap(panel: Image.Image, width: int, cap_height: int) -> Image.Image:
    half = width // 2
    center = max(
        range(half, panel.width - half),
        key=lambda x: sum(panel.height - column_top(panel, sx) for sx in range(x - half, x + half)),
    )
    crop = panel.crop((center - half, 0, center - half + width, panel.height))
    cap = Image.new("RGBA", crop.size, (0, 0, 0, 0))
    src = crop.load()
    dst = cap.load()
    for x in range(width):
        normalized = x / max(1, width - 1)
        dome = max(1, round(cap_height * (1 - abs(normalized * 2 - 1) ** 1.6)))
        surface = column_top(crop, x)
        for offset in range(dome):
            source_y = min(panel.height - 1, surface + offset)
            target_y = panel.height - dome + offset
            if src[x, source_y][3]:
                dst[x, target_y] = src[x, source_y]
    return cap


def paste_wrapped(base: Image.Image, overlay: Image.Image, center_x: int) -> None:
    left = center_x - overlay.width // 2
    for shifted in (left - base.width, left, left + base.width):
        dst_left = max(0, shifted)
        dst_right = min(base.width, shifted + overlay.width)
        if dst_left >= dst_right:
            continue
        src_left = dst_left - shifted
        part = overlay.crop((src_left, 0, src_left + dst_right - dst_left, overlay.height))
        base.alpha_composite(part, (dst_left, 0))


def build_layer(name: str, spec: dict) -> tuple[Image.Image, dict]:
    source = load_subject(SOURCE_DIR / spec["source"])
    bbox = source.getbbox()
    if bbox is None:
        raise ValueError(f"empty generated source: {spec['source']}")
    cropped = source.crop(bbox)
    scaled_height = round(cropped.height * PANEL_WIDTH / cropped.width)
    if scaled_height > spec["height"]:
        raise ValueError(f"{spec['source']}: aspect-preserved height {scaled_height} exceeds {spec['height']}")
    scaled = cropped.resize((PANEL_WIDTH, scaled_height), Image.Resampling.NEAREST)
    panel = Image.new("RGBA", (PANEL_WIDTH, spec["height"]), (0, 0, 0, 0))
    panel.alpha_composite(repalette(scaled, TERRAIN_PALETTE), (0, spec["height"] - scaled_height))
    fill_underbody(panel, TERRAIN_PALETTE[0])
    repair_wrap(panel, TERRAIN_PALETTE)

    strip = Image.new("RGBA", (STRIP_WIDTH, spec["height"]), (0, 0, 0, 0))
    for index, variant in enumerate((panel, ImageOps.mirror(panel), panel)):
        strip.alpha_composite(variant, (index * PANEL_WIDTH, 0))
    cap = build_cap(panel, spec["cap_width"], spec["cap_height"])
    for seam_x in (0, PANEL_WIDTH, PANEL_WIDTH * 2):
        paste_wrapped(strip, cap, seam_x)
    (RUN_DIR / "caps").mkdir(parents=True, exist_ok=True)
    cap.save(RUN_DIR / "caps" / f"{name}-seam-cap.png")
    strip.paste(strip.crop((0, 0, 1, strip.height)), (strip.width - 1, 0))
    heights = [strip.height - column_top(strip, x) for x in range(strip.width)]
    return strip, {
        "source_size": list(source.size), "source_bbox": list(bbox),
        "content_size": [PANEL_WIDTH, scaled_height], "height_range": [min(heights), max(heights)],
        "panel_width": PANEL_WIDTH, "panel_count": 3, "runtime_scale": 1,
        "scale": round(PANEL_WIDTH / cropped.width, 6), "aspect_preserved": True,
        "seam_cap": {
            "generated": f"caps/{name}-seam-cap.png", "positions": [0, 480, 960],
            "size": list(cap.size), "runtime_scale": 1, "source": f"sources/{spec['source']}",
        },
    }


def blend(left: tuple[int, int, int], right: tuple[int, int, int], ratio: float) -> tuple[int, int, int]:
    return tuple(round(a * (1 - ratio) + b * ratio) for a, b in zip(left, right))


def build_sea() -> tuple[Image.Image, dict]:
    source = Image.open(SOURCE_DIR / "sea-long-source-v1.png").convert("RGB")
    crop_height = round(source.width * SEA_SIZE[1] / SEA_SIZE[0])
    top = max(0, (source.height - crop_height) // 2)
    crop_box = [0, top, source.width, top + crop_height]
    output = source.crop(tuple(crop_box)).resize(SEA_SIZE, Image.Resampling.LANCZOS)
    pixels = output.load()
    for y in range(output.height):
        shared = blend(pixels[SEA_SEAM_MARGIN, y], pixels[output.width - 1 - SEA_SEAM_MARGIN, y], 0.5)
        for x in range(SEA_SEAM_MARGIN):
            ratio = x / SEA_SEAM_MARGIN
            pixels[x, y] = blend(shared, pixels[x, y], ratio)
            rx = output.width - 1 - x
            pixels[rx, y] = blend(shared, pixels[rx, y], ratio)
    rgba = Image.new("RGBA", output.size, (0, 0, 0, 255))
    rgba.putdata([(*nearest(pixel, SEA_PALETTE), 255) for pixel in output.get_flattened_data()])
    rgba.paste(rgba.crop((0, 0, 1, rgba.height)), (rgba.width - 1, 0))
    return rgba, {"source_size": list(source.size), "crop_box": crop_box, "runtime_scale": 1}


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    (RUN_DIR / "palette.lock.json").write_text(
        json.dumps({"version": 1, "colors": [list(color) for color in TERRAIN_PALETTE]}, indent=2) + "\n",
        encoding="utf-8",
    )

    layers: dict[str, dict] = {}
    sea, sea_metrics = build_sea()
    sea.save(OUT_DIR / "stage5-sea-strip.png")
    sea.save(RUN_DIR / "sea-strip.png")
    layers["sea"] = {
        "file": "../../../backgrounds/stage5-sea-strip.png", "generated": "sea-strip.png",
        "source": "sources/sea-long-source-v1.png", "width": 1440, "height": 270,
        "parallax": 0.016, "seamless": True, "opaque": True,
        "palette": [f"#{r:02x}{g:02x}{b:02x}" for r, g, b in SEA_PALETTE], **sea_metrics,
    }
    for name, spec in LAYERS.items():
        image, metrics = build_layer(name, spec)
        filename = f"stage5-{name}-strip.png"
        image.save(OUT_DIR / filename)
        image.save(RUN_DIR / f"{name}-strip.png")
        layers[name] = {
            "file": f"../../../backgrounds/{filename}", "generated": f"{name}-strip.png",
            "source": f"sources/{spec['source']}", "width": 1440, "height": spec["height"],
            "parallax": spec["parallax"], "seamless": True, **metrics,
        }

    manifest = {
        "version": 1, "kind": "pixel-wave-stage-background", "stage": "stage5",
        "name": "난파선 묘지", "logical_viewport": [480, 270],
        "palette": [list(color) for color in TERRAIN_PALETTE], "layers": layers,
        "wreck_silhouettes": ["bow", "stern", "hull-side", "rib-cage", "mast", "anchor", "keel", "propeller-housing"],
        "runtime_effects": ["murky-shafts", "graveyard-motes", "gameplay-darkness-mask"],
        "prompt_log": "generation-prompts.md",
        "notes": "Distinct wreck fragments are fused into continuous terrain. Native-scale seam caps cover every 480px panel boundary.",
    }
    (RUN_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("built Stage 5 sea + far/mid/near strips")


if __name__ == "__main__":
    main()
