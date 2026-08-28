"""Canonicalize sprite-gen atlases to Pixel Wave's runtime pixel contract."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

from PIL import Image

from pixel_pipeline_common import (
    DEFAULT_RUNS_ROOT,
    MANIFEST_NAME,
    ContractError,
    atomic_save_png,
    atomic_write_json,
    connected_components,
    frame_rects,
    image_pixels,
    load_run_contract,
    resolve_runs,
    sha256_file,
    validate_image_size,
)


VERSION = 1
OUTPUT_NAME = "sprite-sheet-pixel.png"
REPORT_NAME = "pixel-normalize.report.json"


def nearest_color(
    source: tuple[int, int, int], palette: list[tuple[int, int, int]]
) -> tuple[int, int, int]:
    return min(
        palette,
        key=lambda color: (
            (source[0] - color[0]) ** 2
            + (source[1] - color[1]) ** 2
            + (source[2] - color[2]) ** 2
        ),
    )


def remove_small_components(
    pixels: list[tuple[int, int, int, int]],
    sheet_width: int,
    manifest: dict[str, Any],
    maximum_size: int,
) -> int:
    if maximum_size <= 0:
        return 0
    removed = 0
    for _state, _index, rect in frame_rects(manifest):
        frame_indices = [
            (rect["y"] + y) * sheet_width + rect["x"] + x
            for y in range(rect["h"])
            for x in range(rect["w"])
        ]
        mask = [pixels[index][3] == 255 for index in frame_indices]
        for component in connected_components(mask, rect["w"], rect["h"]):
            if len(component) <= maximum_size:
                for local_index in component:
                    pixels[frame_indices[local_index]] = (0, 0, 0, 0)
                    removed += 1
    return removed


def normalize_run(
    run_dir: Path,
    *,
    alpha_threshold: int = 128,
    remove_isolated_max: int = 0,
) -> dict[str, Any]:
    manifest, palette = load_run_contract(run_dir)
    source_name = manifest.get("sprite_sheet_alpha")
    if not isinstance(source_name, str) or not source_name:
        raise ContractError(f"{run_dir.name}: missing sprite_sheet_alpha")
    source_path = run_dir / source_name
    try:
        with Image.open(source_path) as opened:
            image = opened.convert("RGBA")
    except FileNotFoundError as exc:
        raise ContractError(f"{run_dir.name}: missing source atlas {source_name}") from exc
    validate_image_size(run_dir.name, image, manifest)

    source_pixels = image_pixels(image)
    normalized: list[tuple[int, int, int, int]] = []
    color_cache: dict[tuple[int, int, int], tuple[int, int, int]] = {}
    alpha_changed = 0
    remapped = 0
    opaque = 0
    for red, green, blue, alpha in source_pixels:
        if alpha == 0 or alpha < alpha_threshold:
            normalized.append((0, 0, 0, 0))
            alpha_changed += int(alpha != 0 or red != 0 or green != 0 or blue != 0)
            continue
        source_color = (red, green, blue)
        target_color = color_cache.get(source_color)
        if target_color is None:
            target_color = nearest_color(source_color, palette)
            color_cache[source_color] = target_color
        remapped += int(target_color != source_color)
        alpha_changed += int(alpha != 255)
        opaque += 1
        normalized.append((*target_color, 255))

    removed = remove_small_components(
        normalized, image.width, manifest, remove_isolated_max
    )
    output_path = run_dir / OUTPUT_NAME
    output = Image.new("RGBA", image.size)
    output.putdata(normalized)
    atomic_save_png(output_path, output)

    report: dict[str, Any] = {
        "kind": "pixel-wave-normalize-report",
        "version": VERSION,
        "run": run_dir.name,
        "source": source_name,
        "output": OUTPUT_NAME,
        "width": image.width,
        "height": image.height,
        "alpha_threshold": alpha_threshold,
        "palette_colors": len(palette),
        "opaque_pixels_before_cleanup": opaque,
        "alpha_or_transparent_rgb_changed_pixels": alpha_changed,
        "palette_remapped_pixels": remapped,
        "removed_component_pixels": removed,
        "sha256": sha256_file(output_path),
    }
    atomic_write_json(run_dir / REPORT_NAME, report)

    manifest["game_input"] = OUTPUT_NAME
    manifest["pixel_normalization"] = {
        "version": VERSION,
        "source": source_name,
        "palette": "palette.lock.json",
        "report": REPORT_NAME,
        "alpha_threshold": alpha_threshold,
        "remove_isolated_max": remove_isolated_max,
    }
    atomic_write_json(run_dir / MANIFEST_NAME, manifest)
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_dirs", nargs="*", help="sprite run directories")
    parser.add_argument("--all", action="store_true", help="normalize every run")
    parser.add_argument(
        "--root", type=Path, default=DEFAULT_RUNS_ROOT, help="run root used by --all"
    )
    parser.add_argument(
        "--alpha-threshold", type=int, default=128, metavar="0..255"
    )
    parser.add_argument(
        "--remove-isolated-max",
        type=int,
        default=0,
        metavar="PIXELS",
        help="remove per-frame connected components up to this size (default: disabled)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not 0 <= args.alpha_threshold <= 255:
        print("error: --alpha-threshold must be in 0..255", file=sys.stderr)
        return 2
    if args.remove_isolated_max < 0:
        print("error: --remove-isolated-max must be non-negative", file=sys.stderr)
        return 2
    try:
        runs = resolve_runs(args.run_dirs, args.all, args.root)
        for run_dir in runs:
            report = normalize_run(
                run_dir,
                alpha_threshold=args.alpha_threshold,
                remove_isolated_max=args.remove_isolated_max,
            )
            print(
                f"NORMALIZED {report['run']}: {report['width']}x{report['height']}, "
                f"palette {report['palette_colors']}, remapped "
                f"{report['palette_remapped_pixels']}, removed "
                f"{report['removed_component_pixels']}"
            )
    except (ContractError, OSError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
