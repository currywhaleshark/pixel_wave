#!/usr/bin/env python3
"""Build Stage 7 Dragon Palace Approach sea and connected parallax strips."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

import build_stage5_background as pipeline


ROOT = Path(__file__).resolve().parents[1]
RUN_DIR = ROOT / "assets" / "generated" / "backgrounds" / "stage7-palace-approach"
OUT_DIR = ROOT / "assets" / "backgrounds"

SEA_PALETTE = [
    (207, 211, 231), (176, 191, 220), (145, 173, 207), (116, 153, 192),
    (89, 132, 176), (67, 111, 157), (49, 90, 137), (35, 70, 113),
    (24, 51, 88), (15, 35, 64),
]
TERRAIN_PALETTE = [
    (8, 17, 34), (12, 27, 49), (18, 41, 66), (25, 56, 84),
    (34, 73, 102), (45, 91, 119), (59, 111, 137), (76, 132, 153),
    (96, 153, 169), (119, 174, 184), (69, 68, 106), (94, 89, 131),
    (124, 111, 151), (157, 135, 166), (194, 165, 166), (225, 198, 171),
]
LAYERS = {
    "far": {"height": 144, "parallax": 0.08, "source": "far-long-source-v1.png", "cap_width": 54, "cap_height": 18},
    "mid": {"height": 176, "parallax": 0.26, "source": "mid-long-source-v2.png", "cap_width": 74, "cap_height": 32},
    "near": {"height": 208, "parallax": 0.74, "source": "near-long-source-v2.png", "cap_width": 98, "cap_height": 58},
}


def load_subject(path: Path) -> Image.Image:
    """Extract transparent or chroma-magenta generated terrain with binary alpha."""
    source = Image.open(path).convert("RGBA")
    output = Image.new("RGBA", source.size, (0, 0, 0, 0))
    src = source.load()
    dst = output.load()
    for y in range(source.height):
        for x in range(source.width):
            r, g, b, a = src[x, y]
            chroma = r > 180 and b > 180 and g < 100 and r + b > 430
            if a < 128 or chroma:
                continue
            dst[x, y] = (r, g, b, 255)
    return output


def build_sea() -> tuple[Image.Image, dict]:
    """Preserve the full 16:9 source scale, then mirror it into a three-screen strip."""
    source = Image.open(RUN_DIR / "sources" / "sea-long-source-v1.png").convert("RGB")
    panel = ImageOps.fit(source, (480, 270), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    strip = Image.new("RGB", (1440, 270))
    for index, variant in enumerate((panel, ImageOps.mirror(panel), panel)):
        strip.paste(variant, (index * 480, 0))
    pixels = strip.load()
    for y in range(strip.height):
        shared = pipeline.blend(pixels[64, y], pixels[strip.width - 65, y], 0.5)
        for x in range(64):
            ratio = x / 64
            pixels[x, y] = pipeline.blend(shared, pixels[x, y], ratio)
            right_x = strip.width - 1 - x
            pixels[right_x, y] = pipeline.blend(shared, pixels[right_x, y], ratio)
    rgba = Image.new("RGBA", strip.size, (0, 0, 0, 255))
    rgba.putdata([(*pipeline.nearest(pixel, SEA_PALETTE), 255) for pixel in strip.get_flattened_data()])
    rgba.paste(rgba.crop((0, 0, 1, rgba.height)), (rgba.width - 1, 0))
    return rgba, {
        "source_size": list(source.size), "content_size": [480, 270],
        "panel_width": 480, "panel_count": 3, "runtime_scale": 1,
        "aspect_preserved": True,
    }


def repair_wrap(image: Image.Image, palette: list[tuple[int, int, int]], margin: int = 64) -> None:
    """Rotate the terrain so the loop cut lands on a natural low valley."""
    tops = [pipeline.column_top(image, x) for x in range(image.width)]
    seam_x = max(
        range(8, image.width - 8),
        key=lambda x: tops[x] - abs(tops[x] - tops[x - 1]) * 8,
    )
    shifted = Image.new("RGBA", image.size, (0, 0, 0, 0))
    shifted.alpha_composite(image.crop((seam_x, 0, image.width, image.height)), (0, 0))
    shifted.alpha_composite(image.crop((0, 0, seam_x, image.height)), (image.width - seam_x, 0))
    image.paste(shifted)

    margin = 4
    left = pipeline.column_top(image, margin)
    right = pipeline.column_top(image, image.width - 1 - margin)
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


def configure_pipeline() -> None:
    pipeline.RUN_DIR = RUN_DIR
    pipeline.SOURCE_DIR = RUN_DIR / "sources"
    pipeline.OUT_DIR = OUT_DIR
    pipeline.SEA_PALETTE = SEA_PALETTE
    pipeline.TERRAIN_PALETTE = TERRAIN_PALETTE
    pipeline.LAYERS = LAYERS
    pipeline.load_subject = load_subject
    pipeline.repair_wrap = repair_wrap


def main() -> None:
    configure_pipeline()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    (RUN_DIR / "palette.lock.json").write_text(
        json.dumps({"version": 1, "colors": [list(color) for color in TERRAIN_PALETTE]}, indent=2) + "\n",
        encoding="utf-8",
    )

    layers: dict[str, dict] = {}
    sea, sea_metrics = build_sea()
    sea.save(OUT_DIR / "stage7-sea-strip.png")
    sea.save(RUN_DIR / "sea-strip.png")
    layers["sea"] = {
        "file": "../../../backgrounds/stage7-sea-strip.png", "generated": "sea-strip.png",
        "source": "sources/sea-long-source-v1.png", "width": 1440, "height": 270,
        "parallax": 0.020, "seamless": True, "opaque": True,
        "palette": [f"#{r:02x}{g:02x}{b:02x}" for r, g, b in SEA_PALETTE], **sea_metrics,
    }
    for name, spec in LAYERS.items():
        image, metrics = pipeline.build_layer(name, spec)
        filename = f"stage7-{name}-strip.png"
        image.save(OUT_DIR / filename)
        image.save(RUN_DIR / f"{name}-strip.png")
        layers[name] = {
            "file": f"../../../backgrounds/{filename}", "generated": f"{name}-strip.png",
            "source": f"sources/{spec['source']}", "width": 1440, "height": spec["height"],
            "parallax": spec["parallax"], "seamless": True, **metrics,
        }

    manifest = {
        "version": 1, "kind": "pixel-wave-stage-background", "stage": "stage7",
        "name": "용궁 앞바다", "logical_viewport": [480, 270],
        "palette": [list(color) for color in TERRAIN_PALETTE], "layers": layers,
        "terrain_silhouettes": ["pearl-dome", "moon-gate", "palace-tower", "reef-terrace", "dragon-rubble", "coral-bank"],
        "runtime_effects": ["weak-storm-surface", "dawn-shafts", "current-motes", "palace-glimmer"],
        "prompt_log": "generation-prompts.md",
        "notes": "All palace forms are grounded into connected terrain. Native-scale caps cover each 480px join.",
    }
    (RUN_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("built Stage 7 sea + far/mid/near strips")


if __name__ == "__main__":
    main()
