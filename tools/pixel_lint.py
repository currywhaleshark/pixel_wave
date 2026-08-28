"""Lint Pixel Wave runtime atlases against native-resolution pixel rules."""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any

from PIL import Image

from pixel_pipeline_common import (
    DEFAULT_RUNS_ROOT,
    ContractError,
    atomic_write_json,
    connected_components,
    frame_rects,
    image_pixels,
    load_run_contract,
    read_json,
    resolve_runs,
    validate_image_size,
)


VERSION = 1
REPORT_NAME = "pixel-lint.report.json"
AGGREGATE_REPORT_NAME = "pixel-lint.report.json"


def histogram_drift(left: Counter[tuple[int, int, int]], right: Counter[tuple[int, int, int]]) -> float:
    left_total = sum(left.values())
    right_total = sum(right.values())
    if left_total == 0 or right_total == 0:
        return 1.0
    colors = left.keys() | right.keys()
    return 0.5 * sum(
        abs(left[color] / left_total - right[color] / right_total) for color in colors
    )


def lint_run(run_dir: Path, *, drift_warning: float = 0.35) -> dict[str, Any]:
    manifest, palette = load_run_contract(run_dir)
    request_path = run_dir / "sprite-request.json"
    request = read_json(request_path) if request_path.is_file() else {}
    lint_contract = request.get("pixel_lint")
    if not isinstance(lint_contract, dict):
        lint_contract = {}
    input_name = manifest.get("game_input")
    if not isinstance(input_name, str) or not input_name:
        raise ContractError(f"{run_dir.name}: missing game_input")
    input_path = run_dir / input_name
    try:
        with Image.open(input_path) as opened:
            image = opened.convert("RGBA")
    except FileNotFoundError as exc:
        raise ContractError(f"{run_dir.name}: missing game input {input_name}") from exc
    validate_image_size(run_dir.name, image, manifest)

    pixels = image_pixels(image)
    alpha_values = sorted({pixel[3] for pixel in pixels})
    semi_transparent = sum(1 for pixel in pixels if 0 < pixel[3] < 255)
    opaque_colors = {pixel[:3] for pixel in pixels if pixel[3] == 255}
    palette_set = set(palette)
    foreign_colors = sorted(opaque_colors - palette_set)
    transparent_rgb = sum(1 for pixel in pixels if pixel[3] == 0 and pixel[:3] != (0, 0, 0))

    cell = manifest.get("cell") if isinstance(manifest.get("cell"), dict) else {}
    margin_x = cell.get("safe_margin_x", 0)
    margin_y = cell.get("safe_margin_y", 0)
    if not isinstance(margin_x, int) or margin_x < 0:
        margin_x = 0
    if not isinstance(margin_y, int) or margin_y < 0:
        margin_y = 0

    frames: list[dict[str, Any]] = []
    histograms: dict[str, list[Counter[tuple[int, int, int]]]] = {}
    state_bboxes: dict[str, list[tuple[int, int]]] = {}
    empty_frames = 0
    isolated_pixels = 0
    tiny_components = 0
    margin_touches = 0
    for state, index, rect in frame_rects(manifest):
        crop = image.crop(
            (rect["x"], rect["y"], rect["x"] + rect["w"], rect["y"] + rect["h"])
        )
        frame_pixels = image_pixels(crop)
        mask = [pixel[3] == 255 for pixel in frame_pixels]
        opaque_count = sum(mask)
        alpha_bbox = crop.getchannel("A").point(lambda alpha: 255 if alpha == 255 else 0).getbbox()
        bbox_width = alpha_bbox[2] - alpha_bbox[0] if alpha_bbox else 0
        bbox_height = alpha_bbox[3] - alpha_bbox[1] if alpha_bbox else 0
        bbox_aspect = bbox_width / bbox_height if bbox_height else 0.0
        state_bboxes.setdefault(state, []).append((bbox_width, bbox_height))
        components = connected_components(mask, rect["w"], rect["h"])
        isolated = sum(1 for component in components if len(component) == 1)
        tiny = sum(1 for component in components if len(component) <= 3)
        isolated_pixels += isolated
        tiny_components += tiny
        empty_frames += int(opaque_count == 0)

        touches_margin = False
        if opaque_count and (margin_x > 0 or margin_y > 0):
            for local_index, is_opaque in enumerate(mask):
                if not is_opaque:
                    continue
                x = local_index % rect["w"]
                y = local_index // rect["w"]
                if (
                    x < margin_x
                    or x >= rect["w"] - margin_x
                    or y < margin_y
                    or y >= rect["h"] - margin_y
                ):
                    touches_margin = True
                    break
        margin_touches += int(touches_margin)

        histogram = Counter(pixel[:3] for pixel in frame_pixels if pixel[3] == 255)
        histograms.setdefault(state, []).append(histogram)
        frames.append(
            {
                "state": state,
                "index": index,
                "width": rect["w"],
                "height": rect["h"],
                "opaque_pixels": opaque_count,
                "bbox": list(alpha_bbox) if alpha_bbox else None,
                "bbox_width": bbox_width,
                "bbox_height": bbox_height,
                "bbox_aspect_ratio": round(bbox_aspect, 6),
                "colors": len(histogram),
                "components": len(components),
                "isolated_1px_components": isolated,
                "tiny_components_max_3px": tiny,
                "touches_safe_margin": touches_margin,
            }
        )

    drift_pairs: list[dict[str, Any]] = []
    for state, state_histograms in histograms.items():
        for index in range(1, len(state_histograms)):
            drift = histogram_drift(state_histograms[index - 1], state_histograms[index])
            drift_pairs.append(
                {
                    "state": state,
                    "from": index - 1,
                    "to": index,
                    "histogram_drift": round(drift, 6),
                }
            )
    max_drift = max((pair["histogram_drift"] for pair in drift_pairs), default=0.0)

    extraction_warnings: list[str] = []
    extraction_manifest_path = run_dir / "frames" / "frames-manifest.json"
    if extraction_manifest_path.is_file():
        extraction_manifest = read_json(extraction_manifest_path)
        raw_warnings = extraction_manifest.get("warnings", [])
        if isinstance(raw_warnings, list):
            extraction_warnings = [warning for warning in raw_warnings if isinstance(warning, str)]
    pitch_warning_markers = (
        "likely a divisor misdetection",
        "pitch disagreement",
        "own pitch",
    )
    pitch_warnings: list[str] = []
    for warning in extraction_warnings:
        if any(marker in warning for marker in pitch_warning_markers):
            pitch_warnings.append(warning)
            continue
        if "one axis may have collapsed" in warning:
            match = re.search(r"\(([0-9.]+)%\)", warning)
            if match and float(match.group(1)) >= 20.0:
                pitch_warnings.append(warning)

    aspect_contract = lint_contract.get("bbox_aspect_ratio")
    aspect_violations: list[dict[str, Any]] = []
    if isinstance(aspect_contract, dict):
        minimum = aspect_contract.get("min")
        maximum = aspect_contract.get("max")
        if isinstance(minimum, (int, float)) and isinstance(maximum, (int, float)):
            for frame in frames:
                ratio = frame["bbox_aspect_ratio"]
                if not minimum <= ratio <= maximum:
                    aspect_violations.append(
                        {
                            "state": frame["state"],
                            "index": frame["index"],
                            "ratio": ratio,
                            "minimum": minimum,
                            "maximum": maximum,
                        }
                    )

    delta_contract = lint_contract.get("max_frame_bbox_delta")
    bbox_delta_violations: list[dict[str, Any]] = []
    if isinstance(delta_contract, dict):
        max_width = delta_contract.get("width")
        max_height = delta_contract.get("height")
        if isinstance(max_width, int) and isinstance(max_height, int):
            for state, boxes in state_bboxes.items():
                for index in range(1, len(boxes)):
                    width_delta = abs(boxes[index][0] - boxes[index - 1][0])
                    height_delta = abs(boxes[index][1] - boxes[index - 1][1])
                    if width_delta > max_width or height_delta > max_height:
                        bbox_delta_violations.append(
                            {
                                "state": state,
                                "from": index - 1,
                                "to": index,
                                "width_delta": width_delta,
                                "height_delta": height_delta,
                                "maximum_width_delta": max_width,
                                "maximum_height_delta": max_height,
                            }
                        )

    failures: list[str] = []
    warnings: list[str] = []
    if semi_transparent:
        failures.append(f"{semi_transparent} semi-transparent pixels")
    if foreign_colors:
        failures.append(f"{len(foreign_colors)} colors outside palette.lock.json")
    if transparent_rgb:
        failures.append(f"{transparent_rgb} transparent pixels retain RGB data")
    if empty_frames:
        failures.append(f"{empty_frames} empty frames")
    if input_name != "sprite-sheet-pixel.png":
        failures.append(f"game_input points to {input_name!r}, not 'sprite-sheet-pixel.png'")
    if pitch_warnings and lint_contract.get("fail_on_pitch_warnings") is True:
        failures.append(f"{len(pitch_warnings)} extraction pitch warnings")
    elif pitch_warnings:
        warnings.append(f"{len(pitch_warnings)} extraction pitch warnings need review")
    if aspect_violations:
        failures.append(f"{len(aspect_violations)} frame bbox aspect violations")
    if bbox_delta_violations:
        failures.append(f"{len(bbox_delta_violations)} adjacent-frame bbox delta violations")
    if isolated_pixels:
        warnings.append(f"{isolated_pixels} isolated 1px components need intent review")
    if margin_touches:
        warnings.append(f"{margin_touches} frames touch their declared safe margin")
    if max_drift > drift_warning:
        warnings.append(
            f"maximum adjacent-frame palette histogram drift is {max_drift:.1%}"
        )

    report: dict[str, Any] = {
        "kind": "pixel-wave-lint-report",
        "version": VERSION,
        "run": run_dir.name,
        "game_input": input_name,
        "ok": not failures,
        "warnings": warnings,
        "failures": failures,
        "checks": {
            "canvas_size": {
                "ok": True,
                "width": image.width,
                "height": image.height,
            },
            "binary_alpha": {
                "ok": semi_transparent == 0,
                "values": alpha_values,
                "semi_transparent_pixels": semi_transparent,
            },
            "palette": {
                "ok": not foreign_colors,
                "used_colors": len(opaque_colors),
                "locked_colors": len(palette),
                "foreign_colors": [list(color) for color in foreign_colors],
            },
            "transparent_rgb_clear": {
                "ok": transparent_rgb == 0,
                "pixels": transparent_rgb,
            },
            "frames_nonempty": {"ok": empty_frames == 0, "empty_frames": empty_frames},
            "isolated_pixels": {
                "ok": isolated_pixels == 0,
                "count": isolated_pixels,
                "tiny_components_max_3px": tiny_components,
                "severity": "warning",
            },
            "safe_margin": {
                "ok": margin_touches == 0,
                "touching_frames": margin_touches,
                "severity": "warning",
            },
            "frame_palette_drift": {
                "ok": max_drift <= drift_warning,
                "maximum": max_drift,
                "warning_threshold": drift_warning,
                "pairs": drift_pairs,
                "severity": "warning",
            },
            "extraction_pitch": {
                "ok": not pitch_warnings,
                "strict": lint_contract.get("fail_on_pitch_warnings") is True,
                "warnings": pitch_warnings,
                "severity": "failure" if lint_contract.get("fail_on_pitch_warnings") is True else "warning",
            },
            "silhouette_contract": {
                "ok": not aspect_violations and not bbox_delta_violations,
                "bbox_aspect_violations": aspect_violations,
                "bbox_delta_violations": bbox_delta_violations,
                "contract": {
                    "bbox_aspect_ratio": aspect_contract,
                    "max_frame_bbox_delta": delta_contract,
                },
            },
            "curve_stair_steps": {
                "status": "manual_review_required",
                "reason": "curve cluster intent cannot be inferred reliably from topology alone",
            },
        },
        "frames": frames,
    }
    atomic_write_json(run_dir / REPORT_NAME, report)
    return report


def print_report(report: dict[str, Any]) -> None:
    checks = report["checks"]
    prefix = report["run"]
    print(f"\n[{prefix}]")
    canvas = checks["canvas_size"]
    print(f"PASS canvas size: {canvas['width']}x{canvas['height']}")
    alpha = checks["binary_alpha"]
    print(
        f"{'PASS' if alpha['ok'] else 'FAIL'} alpha values: {alpha['values']} "
        f"(semi-transparent {alpha['semi_transparent_pixels']})"
    )
    palette = checks["palette"]
    print(
        f"{'PASS' if palette['ok'] else 'FAIL'} palette: "
        f"{palette['used_colors']}/{palette['locked_colors']} colors"
    )
    clear = checks["transparent_rgb_clear"]
    print(
        f"{'PASS' if clear['ok'] else 'FAIL'} transparent RGB pixels: {clear['pixels']}"
    )
    isolated = checks["isolated_pixels"]
    print(
        f"{'PASS' if isolated['ok'] else 'WARN'} isolated 1px components: "
        f"{isolated['count']} (tiny <=3px: {isolated['tiny_components_max_3px']})"
    )
    margin = checks["safe_margin"]
    print(
        f"{'PASS' if margin['ok'] else 'WARN'} safe-margin touches: "
        f"{margin['touching_frames']} frames"
    )
    drift = checks["frame_palette_drift"]
    print(
        f"{'PASS' if drift['ok'] else 'WARN'} frame palette drift: "
        f"{drift['maximum']:.1%} max"
    )
    extraction = checks["extraction_pitch"]
    extraction_status = "PASS" if extraction["ok"] else ("FAIL" if extraction["strict"] else "WARN")
    print(f"{extraction_status} extraction pitch warnings: {len(extraction['warnings'])}")
    silhouette = checks["silhouette_contract"]
    print(
        f"{'PASS' if silhouette['ok'] else 'FAIL'} silhouette contract: "
        f"{len(silhouette['bbox_aspect_violations'])} aspect, "
        f"{len(silhouette['bbox_delta_violations'])} frame-delta violations"
    )
    print("INFO curve stair-step clusters: manual review required")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_dirs", nargs="*", help="sprite run directories")
    parser.add_argument("--all", action="store_true", help="lint every run")
    parser.add_argument(
        "--root", type=Path, default=DEFAULT_RUNS_ROOT, help="run root used by --all"
    )
    parser.add_argument(
        "--drift-warning",
        type=float,
        default=0.35,
        metavar="0..1",
        help="warning threshold for adjacent-frame histogram drift",
    )
    parser.add_argument(
        "--strict-warnings",
        action="store_true",
        help="return a failure exit code when warnings are present",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not 0 <= args.drift_warning <= 1:
        print("error: --drift-warning must be in 0..1", file=sys.stderr)
        return 2
    try:
        runs = resolve_runs(args.run_dirs, args.all, args.root)
        reports = [lint_run(run, drift_warning=args.drift_warning) for run in runs]
        for report in reports:
            print_report(report)
        aggregate = {
            "kind": "pixel-wave-lint-aggregate",
            "version": VERSION,
            "ok": all(report["ok"] for report in reports),
            "runs": [
                {
                    "run": report["run"],
                    "ok": report["ok"],
                    "warnings": len(report["warnings"]),
                    "failures": len(report["failures"]),
                }
                for report in reports
            ],
        }
        if args.all:
            atomic_write_json(args.root.resolve().parent / AGGREGATE_REPORT_NAME, aggregate)
        failures = [report for report in reports if not report["ok"]]
        warnings = [report for report in reports if report["warnings"]]
        print(
            f"\nSUMMARY {len(reports) - len(failures)}/{len(reports)} runs pass; "
            f"{len(warnings)} runs have warnings"
        )
        return 1 if failures or (args.strict_warnings and warnings) else 0
    except (ContractError, OSError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
