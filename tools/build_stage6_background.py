#!/usr/bin/env python3
"""Build Stage 6 Storm Surface sea and connected parallax strips."""

from __future__ import annotations

import json
from pathlib import Path

import build_stage5_background as pipeline


ROOT = Path(__file__).resolve().parents[1]
RUN_DIR = ROOT / "assets" / "generated" / "backgrounds" / "stage6-storm-surface"
OUT_DIR = ROOT / "assets" / "backgrounds"

SEA_PALETTE = [
    (158, 185, 208), (126, 154, 181), (99, 126, 157), (76, 101, 134),
    (58, 80, 111), (44, 62, 89), (33, 48, 72), (24, 37, 58),
    (17, 28, 46), (11, 20, 35),
]
TERRAIN_PALETTE = [
    (7, 15, 27), (10, 22, 38), (14, 30, 49), (19, 39, 61),
    (25, 50, 75), (33, 63, 91), (43, 77, 105), (55, 92, 119),
    (70, 108, 134), (88, 126, 151), (108, 145, 169), (131, 164, 185),
    (19, 55, 66), (27, 75, 83), (39, 96, 98), (58, 118, 113),
]
LAYERS = {
    "far": {"height": 80, "parallax": 0.10, "source": "far-long-source-v1.png", "cap_width": 48, "cap_height": 15},
    "mid": {"height": 128, "parallax": 0.30, "source": "mid-long-source-v1.png", "cap_width": 68, "cap_height": 30},
    "near": {"height": 144, "parallax": 0.78, "source": "near-long-source-v1.png", "cap_width": 94, "cap_height": 54},
}


def configure_pipeline() -> None:
    pipeline.RUN_DIR = RUN_DIR
    pipeline.SOURCE_DIR = RUN_DIR / "sources"
    pipeline.OUT_DIR = OUT_DIR
    pipeline.SEA_PALETTE = SEA_PALETTE
    pipeline.TERRAIN_PALETTE = TERRAIN_PALETTE
    pipeline.LAYERS = LAYERS


def main() -> None:
    configure_pipeline()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    (RUN_DIR / "palette.lock.json").write_text(
        json.dumps({"version": 1, "colors": [list(color) for color in TERRAIN_PALETTE]}, indent=2) + "\n",
        encoding="utf-8",
    )

    layers: dict[str, dict] = {}
    sea, sea_metrics = pipeline.build_sea()
    sea.save(OUT_DIR / "stage6-sea-strip.png")
    sea.save(RUN_DIR / "sea-strip.png")
    layers["sea"] = {
        "file": "../../../backgrounds/stage6-sea-strip.png", "generated": "sea-strip.png",
        "source": "sources/sea-long-source-v1.png", "width": 1440, "height": 270,
        "parallax": 0.028, "seamless": True, "opaque": True,
        "palette": [f"#{r:02x}{g:02x}{b:02x}" for r, g, b in SEA_PALETTE], **sea_metrics,
    }
    for name, spec in LAYERS.items():
        image, metrics = pipeline.build_layer(name, spec)
        filename = f"stage6-{name}-strip.png"
        image.save(OUT_DIR / filename)
        image.save(RUN_DIR / f"{name}-strip.png")
        layers[name] = {
            "file": f"../../../backgrounds/{filename}", "generated": f"{name}-strip.png",
            "source": f"sources/{spec['source']}", "width": 1440, "height": spec["height"],
            "parallax": spec["parallax"], "seamless": True, **metrics,
        }

    manifest = {
        "version": 1, "kind": "pixel-wave-stage-background", "stage": "stage6",
        "name": "폭풍 수면", "logical_viewport": [480, 270],
        "palette": [list(color) for color in TERRAIN_PALETTE], "layers": layers,
        "terrain_silhouettes": ["wind-cut-shelf", "hooked-ledge", "slanted-fin", "boulder-bank", "bent-seagrass"],
        "runtime_effects": ["storm-surface-band", "current-motes", "underwater-lightning", "current-hud"],
        "prompt_log": "generation-prompts.md",
        "notes": "Storm-eroded shelves remain connected at native scale. Runtime waves and lightning stay code-driven.",
    }
    (RUN_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("built Stage 6 sea + far/mid/near strips")


if __name__ == "__main__":
    main()
