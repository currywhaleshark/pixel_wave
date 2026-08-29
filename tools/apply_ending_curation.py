#!/usr/bin/env python3
"""Promote the single curated ending candidate to the runtime screen asset."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
RUN_DIR = ROOT / "assets" / "generated" / "screens" / "ending-screen-v1"
CURATION_RUN = RUN_DIR / "curation-run"


def main() -> None:
    curation = json.loads((CURATION_RUN / "curation.json").read_text(encoding="utf-8"))
    frames = json.loads((CURATION_RUN / "frames" / "frames-manifest.json").read_text(encoding="utf-8"))
    selected = curation["states"]["items"]["selected"]
    if len(selected) != 1:
        raise ValueError(f"expected one ending candidate, got {selected}")
    row = next(row for row in frames["rows"] if row["state"] == "items")
    label = row["labels"][selected[0]]
    curated = CURATION_RUN / "curated" / f"{label}.png"
    image = Image.open(curated).convert("RGB")
    if image.size != (480, 270):
        raise ValueError(f"ending candidate has wrong size: {image.size}")

    output = ROOT / "assets" / "screens" / "ending-background.png"
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(curated, output)

    manifest_path = RUN_DIR / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["selected_candidate"] = label
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"ending_candidate={label}")
    print(f"output={output.relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    main()
