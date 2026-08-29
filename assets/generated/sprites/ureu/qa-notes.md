# Ureu sprite QA

- Base Lock Gate: PASS — complete uncropped crown-to-tail master, stable identity, continuous neck/body silhouette, transparent chroma-ready background.
- `idle` motion continuity: PASS — four-frame loop keeps the head anchor stable while a broad S-wave travels through the upper, middle, and lower torso into the tail. The loop no longer reads as a tail-only wag.
- Runtime scale: PASS — deterministic extraction targets `48×128` world pixels so the game renders on the established 2× pixel grid at the same approximate height as the former procedural body.
- Pixel contract: PASS — 14 locked colors, binary alpha, no foreign colors, no isolated one-pixel components, and no extraction pitch warnings.
- Manual curation: all four frames retained in order; frame 0 transform preserved after runtime-scale extraction.
