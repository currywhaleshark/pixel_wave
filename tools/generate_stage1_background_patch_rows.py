#!/usr/bin/env python3
"""Generate the four Stage 1 background patch rows through sprite-gen."""

from __future__ import annotations

import subprocess
import sys
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / "assets" / "generated" / "backgrounds" / "stage1-coral-patches"
GEN = Path(r"C:\Users\yurib\.codex\skills\sprite-gen\scripts\generate_sprite_image.py")
STATES = ("far_reef", "mid_reef", "near_reef", "shell_landmark")


def generate(state: str) -> tuple[str, int, str]:
    command = [
        sys.executable,
        str(GEN),
        "--provider",
        "codex",
        "--prompt-file",
        str(RUN / "prompts" / f"{state}.txt"),
        "--out",
        str(RUN / "raw" / f"{state}.png"),
        "--ref",
        str(RUN / "base-source.png"),
        "--ref",
        str(RUN / "references" / "layout-guides" / f"{state}.png"),
        "--report",
        str(RUN / "raw" / f"{state}.generation.json"),
    ]
    child_env = os.environ.copy()
    child_env["PYTHONUTF8"] = "1"
    child_env["PYTHONIOENCODING"] = "utf-8"
    result = subprocess.run(
        command,
        cwd=ROOT,
        env=child_env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return state, result.returncode, (result.stdout + result.stderr).strip()


def main() -> int:
    failures = 0
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(generate, state) for state in STATES]
        for future in as_completed(futures):
            state, code, output = future.result()
            print(f"[{state}] exit={code}")
            if output:
                print(output)
            failures += code != 0
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
