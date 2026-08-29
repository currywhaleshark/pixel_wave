#!/usr/bin/env python3
"""Bake curated navigation-map stills into deterministic runtime assets."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SCREEN_RUN = ROOT / "assets" / "generated" / "screens" / "map-screen-v1"
ICON_RUN = ROOT / "assets" / "generated" / "map-icons-v1"
STAGE_IDS = [
    "stage1-coral",
    "stage2-jelly",
    "stage3-current",
    "stage4-trench",
    "stage5-wreck",
    "stage6-storm",
    "stage7-palace-water",
]


def selected_labels(run_dir: Path) -> dict[str, str]:
    curation = json.loads((run_dir / "curation.json").read_text(encoding="utf-8"))
    frames = json.loads((run_dir / "frames" / "frames-manifest.json").read_text(encoding="utf-8"))
    labels = {row["state"]: row["labels"] for row in frames["rows"]}
    result: dict[str, str] = {}
    for state, entry in curation.get("states", {}).items():
        selected = entry.get("selected", [])
        if len(selected) != 1:
            raise ValueError(f"{state}: expected exactly one selected candidate, got {selected}")
        result[state] = labels[state][selected[0]]
    return result


def only_curated(run_dir: Path, prefix: str = "") -> Path:
    matches = sorted((run_dir / "curated").glob(f"{prefix}*.png"))
    if len(matches) != 1:
        raise ValueError(f"{run_dir}: expected one curated PNG for {prefix!r}, got {len(matches)}")
    return matches[0]


def assert_binary_alpha(image: Image.Image, name: str) -> list[int]:
    values = sorted(set(image.getchannel("A").get_flattened_data()))
    if not set(values).issubset({0, 255}):
        raise ValueError(f"{name}: non-binary alpha values {values[:12]}")
    return values


def normalize_alpha(image: Image.Image) -> Image.Image:
    normalized = image.copy()
    normalized.putalpha(image.getchannel("A").point(lambda value: 255 if value >= 128 else 0))
    return normalized


def main() -> None:
    screen_labels = selected_labels(SCREEN_RUN / "curation-run")
    icon_labels = selected_labels(ICON_RUN / "curation-run")

    background_source = only_curated(SCREEN_RUN / "curation-run")
    background = Image.open(background_source).convert("RGB")
    if background.size != (480, 270):
        raise ValueError(f"map background has wrong size: {background.size}")
    screen_output = ROOT / "assets" / "screens" / "map-background.png"
    screen_output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(background_source, screen_output)

    curated_dir = ICON_RUN / "curation-run" / "curated"
    atlas = Image.new("RGBA", (24 * len(STAGE_IDS), 24), (0, 0, 0, 0))
    qa_assets: dict[str, object] = {}
    for index, asset_id in enumerate(STAGE_IDS):
        source = only_curated(ICON_RUN / "curation-run", f"{asset_id}-")
        padded = Image.open(source).convert("RGBA")
        if padded.size != (48, 40):
            raise ValueError(f"{asset_id}: unexpected curated cell {padded.size}")
        icon = normalize_alpha(padded.crop((12, 8, 36, 32)))
        alpha_values = assert_binary_alpha(icon, asset_id)
        atlas.alpha_composite(icon, (index * 24, 0))
        qa_assets[asset_id] = {
            "candidate": icon_labels[asset_id],
            "size": list(icon.size),
            "opaque_pixels": sum(1 for value in icon.getchannel("A").get_flattened_data() if value),
            "alpha_values": alpha_values,
        }

    atlas_output = ROOT / "assets" / "stage-icons.png"
    atlas.save(atlas_output)

    home_source = only_curated(ICON_RUN / "curation-run", "home-dragon-palace-")
    home = normalize_alpha(Image.open(home_source).convert("RGBA"))
    if home.size != (48, 40):
        raise ValueError(f"home: unexpected curated size {home.size}")
    home_alpha = assert_binary_alpha(home, "home-dragon-palace")
    home_output = ROOT / "assets" / "map-home.png"
    home.save(home_output)
    qa_assets["home-dragon-palace"] = {
        "candidate": icon_labels["home-dragon-palace"],
        "size": list(home.size),
        "opaque_pixels": sum(1 for value in home.getchannel("A").get_flattened_data() if value),
        "alpha_values": home_alpha,
    }

    (ICON_RUN / "qa-report.json").write_text(
        json.dumps(
            {
                "ok": True,
                "background": {
                    "candidate": screen_labels["items"],
                    "size": list(background.size),
                    "output": str(screen_output.relative_to(ROOT)).replace("\\", "/"),
                },
                "stage_atlas": {
                    "size": list(atlas.size),
                    "output": str(atlas_output.relative_to(ROOT)).replace("\\", "/"),
                },
                "home_output": str(home_output.relative_to(ROOT)).replace("\\", "/"),
                "assets": qa_assets,
            },
            ensure_ascii=False,
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )
    print("applied curated map background, seven stage icons, and Dragon Palace home")


if __name__ == "__main__":
    main()
