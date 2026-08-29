"""Pack approved sprite-gen runs into the fixed ART_SPEC sheet coordinates."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
RUNS = ROOT / "assets" / "generated" / "sprites"


@dataclass(frozen=True)
class Placement:
    run: str
    state: str
    x: int
    y: int
    width: int
    height: int
    frames: int


MAIN = (
    Placement("mermaid-swim", "swim", 0, 0, 36, 24, 4),
    Placement("mermaid-bubble", "bubble", 144, 0, 24, 24, 2),
    Placement("dolphin-homing", "swim", 0, 24, 18, 10, 2),
    Placement("dolphin-burst", "swim", 36, 24, 18, 10, 2),
    Placement("dolphin-pierce", "swim", 72, 24, 18, 10, 2),
    Placement("enemy-fish", "swim", 0, 40, 16, 10, 2),
    Placement("enemy-jelly", "float", 32, 40, 16, 20, 2),
    Placement("enemy-ray", "flap", 64, 36, 32, 26, 2),
    Placement("enemy-turret", "idle", 136, 40, 16, 14, 1),
    Placement("enemy-lantern", "float", 0, 64, 18, 24, 2),
    Placement("enemy-viper", "swim", 36, 64, 20, 10, 2),
    Placement("enemy-ghost", "float", 76, 64, 14, 12, 2),
    Placement("enemy-big", "swim", 0, 96, 32, 24, 2),
    Placement("enemy-wreck", "variants", 64, 96, 40, 32, 4),
    Placement("turtle-taxi", "paddle", 0, 128, 32, 20, 2),
    Placement("pearl-small", "idle", 0, 152, 6, 6, 1),
    Placement("pearl-big", "idle", 8, 152, 10, 10, 1),
    Placement("bullet-bubble", "idle", 24, 152, 8, 8, 1),
    Placement("bullet-spike", "idle", 32, 152, 8, 8, 1),
    Placement("bullet-mine", "blink", 40, 152, 10, 10, 2),
    Placement("bullet-star", "blink", 64, 152, 10, 10, 2),
    Placement("shot-wave", "shot", 88, 152, 10, 6, 1),
)

BOSSES = (
    Placement("pangpang", "idle", 0, 0, 48, 48, 2),
    Placement("mongsil", "idle", 96, 0, 48, 56, 2),
    Placement("ssing", "flap", 0, 64, 56, 40, 2),
    Placement("chorong", "idle", 112, 64, 56, 48, 2),
    Placement("buu", "idle", 0, 128, 40, 32, 2),
)

BUU_HULL = (
    Placement("buu-hull", "idle", 0, 0, 64, 250, 1),
)

UREU = (
    Placement("ureu", "idle", 0, 0, 48, 128, 4),
)

HWII = (
    Placement("hwii", "idle", 0, 0, 64, 64, 4),
)

HWII_ARM = (
    Placement("hwii-arm", "flow", 0, 0, 72, 40, 2),
)


def load_frames(item: Placement) -> list[Image.Image]:
    run_dir = RUNS / item.run
    manifest = json.loads((run_dir / "manifest.json").read_text(encoding="utf-8"))
    rects = manifest["frame_layout"]["rows"][item.state]
    if len(rects) != item.frames:
        raise ValueError(f"{item.run}:{item.state} expected {item.frames} frames, got {len(rects)}")

    game_input = manifest.get("game_input")
    if not isinstance(game_input, str) or not game_input:
        raise ValueError(f"{item.run}: manifest has no game_input")
    atlas_path = run_dir / game_input
    if not atlas_path.is_file():
        raise FileNotFoundError(
            f"{item.run}: game_input {game_input!r} does not exist; run pixel_normalize.py first"
        )
    atlas = Image.open(atlas_path).convert("RGBA")
    result: list[Image.Image] = []
    for index, rect in enumerate(rects):
        size = (rect["w"], rect["h"])
        if size != (item.width, item.height):
            raise ValueError(
                f"{item.run}:{item.state}[{index}] expected {item.width}x{item.height}, "
                f"got {size[0]}x{size[1]}"
            )
        result.append(
            atlas.crop((rect["x"], rect["y"], rect["x"] + rect["w"], rect["y"] + rect["h"]))
        )
    return result


def build(path: Path, size: tuple[int, int], placements: tuple[Placement, ...]) -> None:
    sheet = Image.new("RGBA", size, (0, 0, 0, 0))
    occupied: set[tuple[int, int]] = set()
    for item in placements:
        for index, frame in enumerate(load_frames(item)):
            x = item.x + index * item.width
            y = item.y
            if x < 0 or y < 0 or x + item.width > size[0] or y + item.height > size[1]:
                raise ValueError(f"{item.run}:{item.state}[{index}] exceeds {path.name}")
            cells = {
                (px, py)
                for px in range(x, x + item.width)
                for py in range(y, y + item.height)
            }
            overlap = occupied.intersection(cells)
            if overlap:
                raise ValueError(f"{item.run}:{item.state}[{index}] overlaps another placement")
            occupied.update(cells)
            sheet.alpha_composite(frame, (x, y))
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path, format="PNG", optimize=False)


def main() -> None:
    build(ROOT / "assets" / "sprites.png", (224, 168), MAIN)
    build(ROOT / "assets" / "bosses.png", (256, 240), BOSSES)
    build(ROOT / "assets" / "backgrounds" / "stage5-buu-hull.png", (64, 250), BUU_HULL)
    build(ROOT / "assets" / "boss-ureu.png", (192, 128), UREU)
    build(ROOT / "assets" / "boss-hwii.png", (256, 64), HWII)
    build(ROOT / "assets" / "boss-hwii-arm.png", (144, 40), HWII_ARM)
    print("packed sprites.png, bosses.png, stage5-buu-hull.png, boss-ureu.png, boss-hwii.png and boss-hwii-arm.png")


if __name__ == "__main__":
    main()
