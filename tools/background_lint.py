#!/usr/bin/env python3
"""Lint deterministic background strips against their manifest and palette."""

from __future__ import annotations

import json
import sys
import hashlib
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]


def lint(run_dir: Path) -> list[str]:
    errors: list[str] = []
    manifest = json.loads((run_dir / "manifest.json").read_text(encoding="utf-8"))
    palette_lock = json.loads((run_dir / "palette.lock.json").read_text(encoding="utf-8"))
    if palette_lock.get("colors") != manifest.get("palette"):
        errors.append("palette.lock.json does not match manifest palette")
    locked = {
        color.lower() if isinstance(color, str) else f"#{color[0]:02x}{color[1]:02x}{color[2]:02x}"
        for color in manifest["palette"]
    }
    digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    for name, layer in manifest["layers"].items():
        generated = run_dir / layer["generated"]
        runtime = (run_dir / layer["file"]).resolve()
        if not generated.is_file():
            errors.append(f"{name}: missing generated strip")
            continue
        image = Image.open(generated).convert("RGBA")
        expected = (layer["width"], layer["height"])
        if image.size != expected:
            errors.append(f"{name}: size {image.size} != {expected}")
        pixels = list(image.get_flattened_data())
        alpha = {pixel[3] for pixel in pixels}
        if not alpha <= {0, 255}:
            errors.append(f"{name}: non-binary alpha values: {sorted(alpha - {0, 255})[:8]}")
        used = {f"#{r:02x}{g:02x}{b:02x}" for r, g, b, a in pixels if a}
        foreign = used - locked
        if foreign:
            errors.append(f"{name}: foreign colors: {sorted(foreign)}")
        if image.crop((0, 0, 1, image.height)).tobytes() != image.crop((image.width - 1, 0, image.width, image.height)).tobytes():
            errors.append(f"{name}: first/last columns differ")
        if any(image.getpixel((x, image.height - 1))[3] != 255 for x in range(image.width)):
            errors.append(f"{name}: transparent gap along terrain floor")
        if not runtime.is_file():
            errors.append(f"{name}: missing runtime strip: {runtime}")
        elif digest(generated) != digest(runtime):
            errors.append(f"{name}: runtime strip differs from generated strip")
    return errors


def lint_sea(run_dir: Path) -> list[str]:
    errors: list[str] = []
    manifest = json.loads((run_dir / "manifest.json").read_text(encoding="utf-8"))
    palette_lock = json.loads((run_dir / "palette.lock.json").read_text(encoding="utf-8"))
    if palette_lock.get("colors") != manifest.get("palette"):
        errors.append("palette.lock.json does not match manifest palette")
    generated = run_dir / manifest["generated"]
    runtime = (run_dir / manifest["file"]).resolve()
    if not generated.is_file():
        return ["missing generated sea strip"]
    image = Image.open(generated).convert("RGBA")
    if image.size != (1440, 270):
        errors.append(f"size {image.size} != (1440, 270)")
    pixels = list(image.get_flattened_data())
    if {pixel[3] for pixel in pixels} != {255}:
        errors.append("sea strip is not fully opaque")
    used = {f"#{r:02x}{g:02x}{b:02x}" for r, g, b, _ in pixels}
    foreign = used - {color.lower() for color in manifest["palette"]}
    if foreign:
        errors.append(f"foreign colors: {sorted(foreign)}")
    if image.crop((0, 0, 1, image.height)).tobytes() != image.crop((image.width - 1, 0, image.width, image.height)).tobytes():
        errors.append("first/last columns differ")
    if not runtime.is_file():
        errors.append(f"missing runtime strip: {runtime}")
    elif hashlib.sha256(generated.read_bytes()).digest() != hashlib.sha256(runtime.read_bytes()).digest():
        errors.append("runtime strip differs from generated strip")
    return errors


def lint_stage2(run_dir: Path) -> list[str]:
    errors: list[str] = []
    manifest = json.loads((run_dir / "manifest.json").read_text(encoding="utf-8"))
    terrain_lock = json.loads((run_dir / "palette.lock.json").read_text(encoding="utf-8"))["colors"]
    terrain_palette = {f"#{r:02x}{g:02x}{b:02x}" for r, g, b in terrain_lock}
    digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    for name, layer in manifest["layers"].items():
        generated = run_dir / layer["generated"]
        runtime = (run_dir / layer["file"]).resolve()
        if not generated.is_file():
            errors.append(f"{name}: missing generated strip")
            continue
        image = Image.open(generated).convert("RGBA")
        if image.size != (layer["width"], layer["height"]):
            errors.append(f"{name}: size {image.size} != {(layer['width'], layer['height'])}")
        pixels = list(image.get_flattened_data())
        alpha = {pixel[3] for pixel in pixels}
        expected_alpha = {255} if name == "sea" else {0, 255}
        if not alpha <= expected_alpha or (name == "sea" and alpha != {255}):
            errors.append(f"{name}: invalid alpha values {sorted(alpha)}")
        locked = {color.lower() for color in layer["palette"]} if name == "sea" else terrain_palette
        used = {f"#{r:02x}{g:02x}{b:02x}" for r, g, b, a in pixels if a}
        foreign = used - locked
        if foreign:
            errors.append(f"{name}: foreign colors {sorted(foreign)}")
        if image.crop((0, 0, 1, image.height)).tobytes() != image.crop((image.width - 1, 0, image.width, image.height)).tobytes():
            errors.append(f"{name}: first/last columns differ")
        if name != "sea" and any(image.getpixel((x, image.height - 1))[3] != 255 for x in range(image.width)):
            errors.append(f"{name}: transparent terrain floor gap")
        if name != "sea":
            cap_spec = layer.get("seam_cap")
            if not cap_spec:
                errors.append(f"{name}: missing seam cap metadata")
            else:
                if cap_spec.get("positions") != [0, 480, 960]:
                    errors.append(f"{name}: invalid seam cap positions")
                if cap_spec.get("runtime_scale") != 1:
                    errors.append(f"{name}: seam cap must use runtime scale 1")
                cap_path = run_dir / cap_spec["generated"]
                if not cap_path.is_file():
                    errors.append(f"{name}: missing seam cap image")
                else:
                    cap = Image.open(cap_path).convert("RGBA")
                    if list(cap.size) != cap_spec["size"]:
                        errors.append(f"{name}: seam cap size differs from manifest")
                    cap_pixels = list(cap.get_flattened_data())
                    cap_alpha = {pixel[3] for pixel in cap_pixels}
                    if not cap_alpha <= {0, 255}:
                        errors.append(f"{name}: seam cap has non-binary alpha")
                    cap_used = {f"#{r:02x}{g:02x}{b:02x}" for r, g, b, a in cap_pixels if a}
                    cap_foreign = cap_used - terrain_palette
                    if cap_foreign:
                        errors.append(f"{name}: seam cap foreign colors {sorted(cap_foreign)}")
        if not runtime.is_file():
            errors.append(f"{name}: missing runtime strip")
        elif digest(generated) != digest(runtime):
            errors.append(f"{name}: runtime strip differs from generated strip")
    return errors


def main() -> int:
    run_dir = ROOT / "assets" / "generated" / "backgrounds" / "stage1-coral-strips"
    sea_run = ROOT / "assets" / "generated" / "backgrounds" / "stage1-sea-strip"
    stage2_run = ROOT / "assets" / "generated" / "backgrounds" / "stage2-jelly-meadow"
    stage3_run = ROOT / "assets" / "generated" / "backgrounds" / "stage3-turtle-highway"
    stage4_run = ROOT / "assets" / "generated" / "backgrounds" / "stage4-deep-canyon"
    stage5_run = ROOT / "assets" / "generated" / "backgrounds" / "stage5-wreck-graveyard"
    errors = lint(run_dir)
    sea_errors = lint_sea(sea_run)
    stage2_errors = lint_stage2(stage2_run)
    stage3_errors = lint_stage2(stage3_run)
    stage4_errors = lint_stage2(stage4_run)
    stage5_errors = lint_stage2(stage5_run)
    report = {"ok": not errors, "run": str(run_dir.relative_to(ROOT)), "errors": errors}
    (run_dir / "background-lint.report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    sea_report = {"ok": not sea_errors, "run": str(sea_run.relative_to(ROOT)), "errors": sea_errors}
    (sea_run / "background-lint.report.json").write_text(
        json.dumps(sea_report, indent=2) + "\n", encoding="utf-8"
    )
    stage2_report = {"ok": not stage2_errors, "run": str(stage2_run.relative_to(ROOT)), "errors": stage2_errors}
    (stage2_run / "background-lint.report.json").write_text(
        json.dumps(stage2_report, indent=2) + "\n", encoding="utf-8"
    )
    stage3_report = {"ok": not stage3_errors, "run": str(stage3_run.relative_to(ROOT)), "errors": stage3_errors}
    (stage3_run / "background-lint.report.json").write_text(
        json.dumps(stage3_report, indent=2) + "\n", encoding="utf-8"
    )
    stage4_report = {"ok": not stage4_errors, "run": str(stage4_run.relative_to(ROOT)), "errors": stage4_errors}
    (stage4_run / "background-lint.report.json").write_text(
        json.dumps(stage4_report, indent=2) + "\n", encoding="utf-8"
    )
    stage5_report = {"ok": not stage5_errors, "run": str(stage5_run.relative_to(ROOT)), "errors": stage5_errors}
    (stage5_run / "background-lint.report.json").write_text(
        json.dumps(stage5_report, indent=2) + "\n", encoding="utf-8"
    )
    if errors or sea_errors or stage2_errors or stage3_errors or stage4_errors or stage5_errors:
        for error in errors:
            print(f"FAIL {error}")
        for error in sea_errors:
            print(f"FAIL sea: {error}")
        for error in stage2_errors:
            print(f"FAIL stage2: {error}")
        for error in stage3_errors:
            print(f"FAIL stage3: {error}")
        for error in stage4_errors:
            print(f"FAIL stage4: {error}")
        for error in stage5_errors:
            print(f"FAIL stage5: {error}")
        return 1
    print("PASS stage backgrounds: Stage 1 + Stage 2 + Stage 3 + Stage 4 + Stage 5 sizes, alpha, palette, seamless edges")
    return 0


if __name__ == "__main__":
    sys.exit(main())
