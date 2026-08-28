"""Shared contract helpers for Pixel Wave's deterministic pixel pipeline."""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from pathlib import Path
from typing import Any, Iterable

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RUNS_ROOT = ROOT / "assets" / "generated" / "sprites"
MANIFEST_NAME = "manifest.json"
PALETTE_NAME = "palette.lock.json"


class ContractError(ValueError):
    """Raised when a sprite run does not satisfy the pipeline contract."""


def image_pixels(image: Image.Image) -> list[tuple[int, int, int, int]]:
    """Read pixels without Pillow 13's deprecated getdata() warning."""
    flattened = getattr(image, "get_flattened_data", None)
    if flattened is not None:
        return list(flattened())
    return list(image.getdata())


def read_json(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ContractError(f"missing required file: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ContractError(f"invalid JSON in {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise ContractError(f"expected a JSON object in {path}")
    return data


def atomic_write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(
        dir=path.parent, prefix=f".{path.name}.", suffix=".tmp"
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def atomic_save_png(path: Path, image: Image.Image) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(
        dir=path.parent, prefix=f".{path.name}.", suffix=".tmp"
    )
    os.close(fd)
    temporary = Path(temporary_name)
    try:
        image.save(temporary, format="PNG", optimize=False)
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def discover_runs(root: Path) -> list[Path]:
    if not root.is_dir():
        raise ContractError(f"runs root does not exist: {root}")
    return sorted(
        path
        for path in root.iterdir()
        if path.is_dir() and (path / MANIFEST_NAME).is_file()
    )


def resolve_runs(run_dirs: Iterable[str], all_runs: bool, root: Path) -> list[Path]:
    explicit = [Path(value).resolve() for value in run_dirs]
    if all_runs:
        if explicit:
            raise ContractError("use either explicit run directories or --all, not both")
        runs = discover_runs(root.resolve())
    else:
        runs = explicit
    if not runs:
        raise ContractError("no sprite runs selected; pass run directories or --all")
    for run_dir in runs:
        if not run_dir.is_dir():
            raise ContractError(f"run directory does not exist: {run_dir}")
    return runs


def load_run_contract(run_dir: Path) -> tuple[dict[str, Any], list[tuple[int, int, int]]]:
    manifest = read_json(run_dir / MANIFEST_NAME)
    palette_data = read_json(run_dir / PALETTE_NAME)
    raw_colors = palette_data.get("colors")
    if not isinstance(raw_colors, list) or not raw_colors:
        raise ContractError(f"{run_dir.name}: palette.lock.json has no colors")

    palette: list[tuple[int, int, int]] = []
    for index, value in enumerate(raw_colors):
        if (
            not isinstance(value, list)
            or len(value) != 3
            or any(not isinstance(channel, int) or not 0 <= channel <= 255 for channel in value)
        ):
            raise ContractError(f"{run_dir.name}: invalid palette color at index {index}")
        color = tuple(value)
        if color not in palette:
            palette.append(color)

    layout = manifest.get("frame_layout")
    if not isinstance(layout, dict):
        raise ContractError(f"{run_dir.name}: missing frame_layout")
    width = layout.get("sheetWidth")
    height = layout.get("sheetHeight")
    rows = layout.get("rows")
    if not isinstance(width, int) or width <= 0 or not isinstance(height, int) or height <= 0:
        raise ContractError(f"{run_dir.name}: invalid frame_layout sheet size")
    if not isinstance(rows, dict) or not rows:
        raise ContractError(f"{run_dir.name}: frame_layout has no rows")
    return manifest, palette


def frame_rects(manifest: dict[str, Any]) -> list[tuple[str, int, dict[str, int]]]:
    layout = manifest["frame_layout"]
    sheet_width = layout["sheetWidth"]
    sheet_height = layout["sheetHeight"]
    result: list[tuple[str, int, dict[str, int]]] = []
    for state, rects in layout["rows"].items():
        if not isinstance(rects, list) or not rects:
            raise ContractError(f"state {state!r} has no frame rectangles")
        for index, rect in enumerate(rects):
            if not isinstance(rect, dict):
                raise ContractError(f"{state}[{index}] is not a frame rectangle")
            if any(not isinstance(rect.get(key), int) for key in ("x", "y", "w", "h")):
                raise ContractError(f"{state}[{index}] has non-integer geometry")
            x, y, width, height = (rect[key] for key in ("x", "y", "w", "h"))
            if (
                x < 0
                or y < 0
                or width <= 0
                or height <= 0
                or x + width > sheet_width
                or y + height > sheet_height
            ):
                raise ContractError(f"{state}[{index}] is outside the sprite sheet")
            result.append((state, index, rect))
    return result


def validate_image_size(run_name: str, image: Image.Image, manifest: dict[str, Any]) -> None:
    expected = (
        manifest["frame_layout"]["sheetWidth"],
        manifest["frame_layout"]["sheetHeight"],
    )
    if image.size != expected:
        raise ContractError(
            f"{run_name}: expected sheet {expected[0]}x{expected[1]}, "
            f"got {image.width}x{image.height}"
        )
    frame_rects(manifest)


def connected_components(mask: list[bool], width: int, height: int) -> list[list[int]]:
    """Return 8-connected opaque components for one frame mask."""
    visited = bytearray(width * height)
    components: list[list[int]] = []
    for start, opaque in enumerate(mask):
        if not opaque or visited[start]:
            continue
        visited[start] = 1
        stack = [start]
        component: list[int] = []
        while stack:
            current = stack.pop()
            component.append(current)
            x = current % width
            y = current // width
            for ny in range(max(0, y - 1), min(height, y + 2)):
                for nx in range(max(0, x - 1), min(width, x + 2)):
                    neighbor = ny * width + nx
                    if not visited[neighbor] and mask[neighbor]:
                        visited[neighbor] = 1
                        stack.append(neighbor)
        components.append(component)
    return components
