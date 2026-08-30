#!/usr/bin/env python3
"""Generate a deterministic Pixel Wave terrain mask/profile from a strip PNG."""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import deque
from pathlib import Path

from PIL import Image


PLACEMENT_CLASS = {
    "id": "coral-turret-small",
    "contactWidth": 10,
    "solidDepth": 4,
    "maxSurfaceDelta": 3,
    "minimumCoverage": 0.8,
    "minimumSpacing": 24,
    "minimumScore": 0.72,
    "clearance": {"left": 8, "right": 8, "outward": 14},
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def connected_to_edge(solid: list[list[bool]], edge_y: int) -> list[list[bool]]:
    height = len(solid)
    width = len(solid[0])
    connected = [[False] * width for _ in range(height)]
    queue: deque[tuple[int, int]] = deque()
    for x in range(width):
        if solid[edge_y][x]:
            connected[edge_y][x] = True
            queue.append((x, edge_y))
    while queue:
        x, y = queue.popleft()
        for nx, ny in (((x - 1) % width, y), ((x + 1) % width, y), (x, y - 1), (x, y + 1)):
            if 0 <= ny < height and solid[ny][nx] and not connected[ny][nx]:
                connected[ny][nx] = True
                queue.append((nx, ny))
    return connected


def surface_samples(connected: list[list[bool]], floor: bool) -> list[int | None]:
    height = len(connected)
    width = len(connected[0])
    samples: list[int | None] = []
    for x in range(width):
        ys = [y for y in range(height) if connected[y][x]]
        samples.append((min(ys) if floor else max(ys)) if ys else None)
    return samples


def normal(samples: list[int | None], x: int, floor: bool) -> dict[str, float]:
    width = len(samples)
    left = samples[(x - 1) % width]
    right = samples[(x + 1) % width]
    if left is None or right is None:
        return {"x": 0, "y": -1 if floor else 1}
    dx = float(right - left) * 0.5
    ny = -1.0 if floor else 1.0
    length = max(1e-9, (dx * dx + 1) ** 0.5)
    return {"x": round(dx / length, 6), "y": round(ny / length, 6)}


def candidate_sockets(
    samples: list[int | None], connected: list[list[bool]], placement: dict
) -> list[dict]:
    width = len(samples)
    height = len(connected)
    half = placement["contactWidth"] // 2
    candidates: list[tuple[int, float]] = []
    for x in range(width):
        footprint = [(x + offset) % width for offset in range(-half, placement["contactWidth"] - half)]
        ys = [samples[column] for column in footprint if samples[column] is not None]
        coverage = len(ys) / placement["contactWidth"]
        if coverage < placement["minimumCoverage"] or not ys:
            continue
        delta = max(ys) - min(ys)
        if delta > placement["maxSurfaceDelta"]:
            continue
        support = 0
        total_support = len(ys) * placement["solidDepth"]
        for column in footprint:
            y = samples[column]
            if y is None:
                continue
            for depth in range(placement["solidDepth"]):
                if y + depth < height and connected[y + depth][column]:
                    support += 1
        support_ratio = support / max(1, total_support)
        if support_ratio < placement["minimumCoverage"]:
            continue
        clearance = placement["clearance"]
        clear = 0
        clear_total = 0
        center_y = samples[x]
        if center_y is None:
            continue
        for column_offset in range(-clearance["left"], clearance["right"] + 1):
            column = (x + column_offset) % width
            for outward in range(1, clearance["outward"] + 1):
                y = center_y - outward
                clear_total += 1
                if y < 0 or not connected[y][column]:
                    clear += 1
        clearance_ratio = clear / max(1, clear_total)
        flatness = 1 - delta / max(1, placement["maxSurfaceDelta"] + 1)
        score = coverage * 0.35 + flatness * 0.25 + clearance_ratio * 0.25 + support_ratio * 0.15
        if score >= placement["minimumScore"]:
            candidates.append((x, score))
    candidates.sort(key=lambda entry: (-entry[1], entry[0]))
    selected: list[tuple[int, float]] = []
    spacing = placement["minimumSpacing"]
    for x, score in candidates:
        if all(min((x - old_x) % width, (old_x - x) % width) >= spacing for old_x, _ in selected):
            selected.append((x, score))
    selected.sort()
    return [{
        "id": f"{placement['id']}-floor-x{x:05d}",
        "classId": placement["id"],
        "surface": "floor",
        "x": x,
        "y": samples[x],
        "normal": normal(samples, x, True),
        "score": round(score, 6),
        "source": "generated",
        "reviewStatus": "pending",
    } for x, score in selected]


def apply_overrides(profile: dict, overrides: dict | None) -> None:
    if not overrides:
        return
    expected = profile["binding"]["assetSha256"]
    if overrides.get("assetSha256") != expected:
        raise ValueError("terrain override assetSha256 does not match the source strip")
    sockets = profile["sockets"]
    excluded_ids = set(overrides.get("excludedSocketIds", []))
    ranges = overrides.get("excludeRanges", [])
    sockets[:] = [socket for socket in sockets if socket["id"] not in excluded_ids and not any(
        entry["surface"] == socket["surface"]
        and (not entry.get("classId") or entry["classId"] == socket["classId"])
        and entry["startX"] <= socket["x"] <= entry["endX"]
        for entry in ranges
    )]
    approved = set(overrides.get("approvedSocketIds", []))
    known = {socket["id"] for socket in sockets}
    orphaned = approved - known
    if orphaned:
        raise ValueError(f"orphaned terrain socket approvals: {', '.join(sorted(orphaned))}")
    for socket in sockets:
        if socket["id"] in approved:
            socket["reviewStatus"] = "approved"
    floor = profile["surfaces"]["floor"]["samples"]
    for forced in overrides.get("forcedSockets", []):
        x = forced["x"] % profile["binding"]["width"]
        y = forced["y"]
        sockets.append({
            "id": forced["id"], "classId": forced["classId"], "surface": forced["surface"],
            "x": x, "y": y, "normal": forced["normal"], "score": 1,
            "source": "manual", "reviewStatus": "approved",
            "tags": forced.get("tags", ["explicit-stage1-placement"]),
            "notes": forced["reason"],
        })
        if forced["surface"] == "floor" and floor[x] is not None and abs(floor[x] - y) > 3:
            profile["generation"].setdefault("warnings", []).append(
                f"forced socket {forced['id']} differs from extracted floor by {abs(floor[x] - y)}px"
            )
    sockets.sort(key=lambda socket: (socket["x"], socket["id"]))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--mask-output", type=Path, required=True)
    parser.add_argument("--profile-output", type=Path, required=True)
    parser.add_argument("--overrides", type=Path)
    args = parser.parse_args()

    image = Image.open(args.source).convert("RGBA")
    width, height = image.size
    solid = [[image.getpixel((x, y))[3] >= 128 for x in range(width)] for y in range(height)]
    floor_connected = connected_to_edge(solid, height - 1)
    ceiling_connected = connected_to_edge(solid, 0)
    floor = surface_samples(floor_connected, True)
    ceiling = surface_samples(ceiling_connected, False)

    mask = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    mask_pixels = mask.load()
    for y in range(height):
        for x in range(width):
            if floor_connected[y][x] or ceiling_connected[y][x]:
                mask_pixels[x, y] = (255, 255, 255, 255)
    args.mask_output.parent.mkdir(parents=True, exist_ok=True)
    mask.save(args.mask_output, optimize=False)

    source_hash = sha256(args.source)
    config_hash = hashlib.sha256(json.dumps(PLACEMENT_CLASS, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    profile = {
        "format": "pixel-wave-terrain-profile", "schemaVersion": 1,
        "id": "stage1-near-v1", "name": "산호 초입 전경 지형",
        "binding": {
            "backgroundPresetId": "stage1", "layer": "near", "assetId": "background.stage1.near",
            "assetPath": args.source.as_posix(), "assetSha256": source_hash,
            "structuralMaskPath": args.mask_output.as_posix(), "structuralMaskSha256": sha256(args.mask_output),
            "width": width, "height": height,
        },
        "coordinateSpace": {"unit": "native-pixel", "origin": "image-top-left", "xAxis": "right", "yAxis": "down", "wrapX": True},
        "surfaces": {
            "floor": {"samples": floor, "confidence": [1 if value is not None else 0 for value in floor]},
            "ceiling": {"samples": ceiling, "confidence": [1 if value is not None else 0 for value in ceiling]},
        },
        "placementClasses": [PLACEMENT_CLASS],
        "sockets": candidate_sockets(floor, floor_connected, PLACEMENT_CLASS),
        "generation": {
            "generatorId": "pixel-wave-terrain-generator", "generatorVersion": 1,
            "mode": "structural-mask", "alphaThreshold": 128, "connectivity": 4,
            "configurationSha256": config_hash,
        },
        "review": {"status": "needs-review", "pendingSocketCount": 0},
    }
    overrides = json.loads(args.overrides.read_text(encoding="utf-8")) if args.overrides and args.overrides.exists() else None
    apply_overrides(profile, overrides)
    pending = sum(socket["reviewStatus"] == "pending" for socket in profile["sockets"])
    profile["review"] = {
        "status": "approved" if pending == 0 and overrides else "needs-review",
        "pendingSocketCount": pending,
    }
    if profile["review"]["status"] == "approved":
        profile["review"]["reviewedAssetSha256"] = source_hash
    args.profile_output.parent.mkdir(parents=True, exist_ok=True)
    args.profile_output.write_text(json.dumps(profile, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
