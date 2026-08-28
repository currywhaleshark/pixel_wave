#!/usr/bin/env python3
"""Build deterministic native-resolution background patch atlases."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
RUN_DIR = ROOT / "assets" / "generated" / "backgrounds" / "stage1-coral"
OUT_DIR = ROOT / "assets" / "backgrounds"
ATLAS_SIZE = (256, 160)

PALETTE = {
    "far_dark": "#205f8a",
    "far_light": "#2b78a0",
    "mid_dark": "#154875",
    "mid_light": "#23638a",
    "near_dark": "#0b2851",
    "near_light": "#123965",
    "kelp_dark": "#367d75",
    "kelp_light": "#63a98a",
    "coral_peach": "#e59a8e",
    "coral_light": "#f2bea3",
    "coral_lavender": "#aa8fd0",
    "coral_lavender_light": "#c6a8dc",
    "shell_shadow": "#b97682",
    "shell_mid": "#e6a88f",
    "shell_light": "#f2d09f",
}

PATCHES = {
    "far_shelf_a": (0, 0, 96, 40),
    "far_shelf_b": (96, 0, 80, 40),
    "mid_garden_a": (0, 40, 72, 56),
    "mid_garden_b": (72, 40, 64, 56),
    "top_vines": (208, 40, 48, 48),
    "near_coral_a": (0, 96, 80, 64),
    "near_coral_b": (80, 96, 64, 64),
    "shell_landmark": (144, 96, 80, 64),
}


def rgba(hex_color: str) -> tuple[int, int, int, int]:
    value = hex_color.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4)) + (255,)


def branch(draw: ImageDraw.ImageDraw, x: int, floor: int, color: str, scale: int = 1) -> None:
    c = rgba(color)
    draw.rectangle((x, floor - 20 * scale, x + 3 * scale, floor), fill=c)
    draw.rectangle((x - 6 * scale, floor - 15 * scale, x + 1 * scale, floor - 12 * scale), fill=c)
    draw.rectangle((x - 7 * scale, floor - 19 * scale, x - 4 * scale, floor - 12 * scale), fill=c)
    draw.rectangle((x + 2 * scale, floor - 11 * scale, x + 8 * scale, floor - 8 * scale), fill=c)
    draw.rectangle((x + 7 * scale, floor - 15 * scale, x + 10 * scale, floor - 8 * scale), fill=c)
    draw.rectangle((x - 2 * scale, floor - 24 * scale, x + 3 * scale, floor - 20 * scale), fill=c)


def kelp(draw: ImageDraw.ImageDraw, x: int, floor: int, height: int, color: str) -> None:
    c = rgba(color)
    draw.polygon(
        [(x, floor), (x + 4, floor), (x + 2, floor - 9), (x + 5, floor - 17),
         (x + 3, floor - 26), (x + 6, floor - height), (x + 2, floor - height + 1),
         (x, floor - 27), (x + 2, floor - 18), (x - 1, floor - 10)],
        fill=c,
    )


def shelf(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], variant: int) -> None:
    x, y, w, h = box
    dark = rgba(PALETTE["far_dark"])
    light = rgba(PALETTE["far_light"])
    floor = y + h - 2
    if variant == 0:
        top = [(x + 2, floor - 11), (x + 18, floor - 14), (x + 43, floor - 13),
               (x + 60, floor - 19), (x + 83, floor - 18), (x + 94, floor - 13)]
    else:
        top = [(x + 1, floor - 8), (x + 15, floor - 12), (x + 31, floor - 11),
               (x + 48, floor - 17), (x + 67, floor - 16), (x + 79, floor - 10)]
    draw.polygon(top + [(x + w - 1, floor), (x + 1, floor)], fill=dark)
    draw.line(top, fill=light, width=2)
    for dx, stem in ((20, 7), (26, 11), (57, 8), (66, 12), (72, 6)):
        if dx < w - 4:
            draw.rectangle((x + dx, floor - 14 - stem, x + dx + 1, floor - 14), fill=light)
            draw.rectangle((x + dx - 2, floor - 12 - stem, x + dx + 3, floor - 11 - stem), fill=light)


def garden(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], variant: int) -> None:
    x, y, w, h = box
    floor = y + h - 2
    dark = rgba(PALETTE["mid_dark"])
    light = rgba(PALETTE["mid_light"])
    if variant == 0:
        ridge = [(x + 1, floor - 7), (x + 11, floor - 13), (x + 27, floor - 12),
                 (x + 39, floor - 17), (x + 55, floor - 15), (x + w - 1, floor - 8)]
        coral_x = x + 17
        kelp_x = x + 50
    else:
        ridge = [(x + 1, floor - 9), (x + 15, floor - 10), (x + 29, floor - 18),
                 (x + 46, floor - 16), (x + w - 1, floor - 10)]
        coral_x = x + 42
        kelp_x = x + 17
    draw.polygon(ridge + [(x + w - 1, floor), (x + 1, floor)], fill=dark)
    draw.line(ridge, fill=light, width=2)
    branch(draw, coral_x, floor - 10, PALETTE["coral_lavender" if variant else "coral_peach"])
    kelp(draw, kelp_x, floor - 8, 28, PALETTE["kelp_light"])
    kelp(draw, kelp_x + 7, floor - 7, 20, PALETTE["kelp_dark"])


def near_cluster(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], variant: int) -> None:
    x, y, w, h = box
    floor = y + h - 1
    dark = rgba(PALETTE["near_dark"])
    light = rgba(PALETTE["near_light"])
    draw.polygon(
        [(x, floor - 16), (x + 9, floor - 25), (x + 21, floor - 22),
         (x + 32, floor - 31), (x + 48, floor - 24), (x + w - 1, floor - 18),
         (x + w - 1, floor), (x, floor)],
        fill=dark,
    )
    draw.line((x + 5, floor - 16, x + 20, floor - 19, x + 33, floor - 26, x + w - 5, floor - 17), fill=light, width=2)
    branch(draw, x + 18, floor - 20, PALETTE["coral_lavender" if variant else "coral_peach"])
    kelp(draw, x + w - 24, floor - 17, 34, PALETTE["kelp_dark"])
    kelp(draw, x + w - 16, floor - 14, 27, PALETTE["kelp_light"])
    for tx in (x + 40, x + 48):
        draw.rectangle((tx, floor - 31, tx + 6, floor - 16), fill=rgba(PALETTE["coral_lavender"]))
        draw.rectangle((tx + 1, floor - 33, tx + 5, floor - 30), fill=rgba(PALETTE["coral_lavender_light"]))
        draw.rectangle((tx + 2, floor - 32, tx + 4, floor - 29), fill=dark)


def shell_landmark(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int]) -> None:
    x, y, w, h = box
    floor = y + h - 1
    dark = rgba(PALETTE["near_dark"])
    draw.polygon([(x, floor - 13), (x + 11, floor - 22), (x + 35, floor - 20),
                  (x + 52, floor - 27), (x + 73, floor - 19), (x + w - 1, floor - 10),
                  (x + w - 1, floor), (x, floor)], fill=dark)
    # Stepped shell silhouette, reconstructed at native resolution.
    shell = [(x + 21, floor - 20), (x + 19, floor - 30), (x + 22, floor - 40),
             (x + 29, floor - 49), (x + 40, floor - 54), (x + 52, floor - 51),
             (x + 60, floor - 43), (x + 62, floor - 32), (x + 57, floor - 24),
             (x + 48, floor - 19)]
    draw.polygon(shell, fill=rgba(PALETTE["shell_mid"]))
    draw.line(shell[:8], fill=rgba(PALETTE["shell_light"]), width=3)
    for offset in (0, 7, 14):
        draw.line((x + 31 + offset, floor - 47, x + 27 + offset, floor - 25), fill=rgba(PALETTE["shell_shadow"]), width=2)
    draw.polygon([(x + 46, floor - 20), (x + 61, floor - 31), (x + 72, floor - 29),
                  (x + 76, floor - 23), (x + 69, floor - 18)], fill=rgba(PALETTE["shell_shadow"]))
    branch(draw, x + 10, floor - 15, PALETTE["coral_light"])


def top_vines(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int]) -> None:
    x, y, w, _ = box
    dark = rgba(PALETTE["near_dark"])
    light = rgba(PALETTE["near_light"])
    draw.polygon([(x, y), (x + w - 1, y), (x + w - 1, y + 12), (x + 35, y + 16),
                  (x + 25, y + 12), (x + 13, y + 18), (x, y + 13)], fill=dark)
    draw.line((x + 3, y + 11, x + 15, y + 14, x + 25, y + 9, x + 39, y + 13), fill=light, width=2)
    for dx, length in ((11, 22), (28, 30), (39, 19)):
        draw.rectangle((x + dx, y + 11, x + dx + 2, y + length), fill=dark)
        draw.rectangle((x + dx - 3, y + length - 4, x + dx + 2, y + length - 2), fill=dark)


def main() -> None:
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    image = Image.new("RGBA", ATLAS_SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    shelf(draw, PATCHES["far_shelf_a"], 0)
    shelf(draw, PATCHES["far_shelf_b"], 1)
    garden(draw, PATCHES["mid_garden_a"], 0)
    garden(draw, PATCHES["mid_garden_b"], 1)
    top_vines(draw, PATCHES["top_vines"])
    near_cluster(draw, PATCHES["near_coral_a"], 0)
    near_cluster(draw, PATCHES["near_coral_b"], 1)
    shell_landmark(draw, PATCHES["shell_landmark"])

    run_atlas = RUN_DIR / "patch-atlas.png"
    runtime_atlas = OUT_DIR / "stage1-coral.png"
    image.save(run_atlas)
    image.save(runtime_atlas)

    manifest = {
        "version": 1,
        "kind": "pixel-wave-background",
        "stage": "stage1",
        "name": "산호 초입",
        "concept": "concept.png",
        "game_input": "../../../backgrounds/stage1-coral.png",
        "logical_viewport": [480, 270],
        "atlas": {"width": ATLAS_SIZE[0], "height": ATLAS_SIZE[1]},
        "palette": list(PALETTE.values()),
        "runtime_palette": ["#61ccd4", "#4ab8c8", "#36a3bd", "#267fa8", "#206e9b", "#185884", "#52b8c4", "#86cfc8", "#a7ddd4"],
        "patches": {name: {"x": box[0], "y": box[1], "w": box[2], "h": box[3]} for name, box in PATCHES.items()},
        "layers": [
            {"id": "water", "kind": "code", "parallax": 0},
            {"id": "far_floor", "kind": "code-tile", "parallax": 0.14, "seamless": True},
            {"id": "far", "kind": "patch", "parallax": 0.14},
            {"id": "mid_floor", "kind": "code-tile", "parallax": 0.38, "seamless": True},
            {"id": "mid", "kind": "patch", "parallax": 0.38},
            {"id": "near_floor", "kind": "code-tile", "parallax": 0.82, "seamless": True},
            {"id": "near", "kind": "patch", "parallax": 0.82},
            {"id": "particles", "kind": "code", "parallax": 0.2},
        ],
    }
    (RUN_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (RUN_DIR / "palette.lock.json").write_text(
        json.dumps({"version": 1, "colors": list(PALETTE.values())}, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"built {runtime_atlas.relative_to(ROOT)} ({ATLAS_SIZE[0]}x{ATLAS_SIZE[1]}, {len(PATCHES)} patches)")


if __name__ == "__main__":
    main()
