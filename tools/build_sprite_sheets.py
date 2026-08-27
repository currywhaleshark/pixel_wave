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
    Placement("mermaid-swim", "swim", 0, 0, 24, 16, 4),
    Placement("mermaid-bubble", "bubble", 96, 0, 24, 24, 2),
    Placement("enemy-fish", "swim", 0, 40, 16, 10, 2),
    Placement("enemy-jelly", "float", 32, 40, 16, 20, 2),
    Placement("enemy-turret", "idle", 104, 40, 16, 14, 1),
    Placement("enemy-big", "swim", 0, 96, 32, 24, 2),
    Placement("pearl-small", "idle", 0, 152, 6, 6, 1),
    Placement("pearl-big", "idle", 8, 152, 10, 10, 1),
    Placement("bullet-bubble", "idle", 24, 152, 8, 8, 1),
    Placement("bullet-spike", "idle", 32, 152, 8, 8, 1),
    Placement("bullet-mine", "blink", 40, 152, 10, 10, 2),
    Placement("shot-wave", "shot", 88, 152, 10, 6, 1),
)

BOSSES = (
    Placement("pangpang", "idle", 0, 0, 48, 48, 2),
)


def load_frames(item: Placement) -> list[Image.Image]:
    run_dir = RUNS / item.run
    manifest = json.loads((run_dir / "manifest.json").read_text(encoding="utf-8"))
    rects = manifest["frame_layout"]["rows"][item.state]
    if len(rects) != item.frames:
        raise ValueError(f"{item.run}:{item.state} expected {item.frames} frames, got {len(rects)}")

    atlas = Image.open(run_dir / manifest["sprite_sheet_alpha"]).convert("RGBA")
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
    build(ROOT / "assets" / "sprites.png", (160, 168), MAIN)
    build(ROOT / "assets" / "bosses.png", (256, 240), BOSSES)
    print("packed assets/sprites.png (160x168) and assets/bosses.png (256x240)")


if __name__ == "__main__":
    main()
