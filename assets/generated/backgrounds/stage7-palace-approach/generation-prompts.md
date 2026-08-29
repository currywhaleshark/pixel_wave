# Stage 7 — 용궁 앞바다 source prompts

The source concepts were generated as four independent layers: dawn sea, distant Dragon Palace skyline, palace-approach terraces, and opaque foreground rubble. Every terrain prompt required a single connected silhouette, broad 2–3× height changes, and no visible panel divisions.

The mid and near sources were regenerated on solid `#FF00FF` so binary-alpha extraction does not mistake the source ocean for terrain. The first opaque concept drafts remain in `sources/` as provenance; runtime output uses `mid-long-source-v2.png` and `near-long-source-v2.png`.

Final processing is deterministic: chroma/alpha extraction, nearest-neighbour scale at preserved aspect ratio, locked-palette quantization, connected underbody fill, wrap repair, and native-scale seam caps at `0/480/960`.
