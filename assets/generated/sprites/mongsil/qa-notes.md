# QA notes — Mongsil

- Base lock: PASS — crown, sleepy crescent eyes, cheeks, internal lantern and five attached tentacles are complete and readable.
- `idle` motion continuity: PASS — two-frame loop preserves crown/bell proportions and center while alternating the tentacle sway; correction-loop score 100.
- Runtime review: PASS — crown and amber core remain legible against the Stage 2 violet background; existing boss HP, collision, movement and phase scaling are unchanged.
- Curated alignment: PASS — frame 1 keeps the user's -0.95px / -1.26px placement; it touches the 3px top safe margin but remains fully inside the 48×56 cell.
- Deterministic output: PASS — native 48×56 frames, binary alpha, 14/14 locked colors, no isolated components, 14.6% maximum palette drift, no pitch or silhouette violations.
