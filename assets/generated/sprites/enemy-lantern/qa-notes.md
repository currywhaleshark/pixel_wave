# QA notes — enemy-lantern

- Base lock: PASS — one complete front-facing pose, sleepy face, three attached tentacles and central amber lantern remain readable at target size.
- `float` motion continuity: PASS — two-frame loop keeps a stable bell center and scale while the attached tentacles and lantern strand shift subtly.
- Runtime review: PASS — distinguishable from the regular jellyfish on the Stage 2 violet background; existing `KIND_R.lantern = 13` hit radius is unchanged.
- Curated alignment: PASS — frame 1 keeps the user's +0.71px / -1.07px placement; it touches the 1px top safe margin but remains fully inside the 18×24 cell.
- Deterministic output: PASS — native 18×24 frames, binary alpha, 9/9 locked colors, no isolated components, 20.4% maximum palette drift, no pitch or silhouette violations.
