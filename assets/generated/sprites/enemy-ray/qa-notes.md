# Motion QA

- `flap`: **pass** — 2/2 frames preserve the left-facing head, single bright eye, short tail, navy-periwinkle palette, and dark indigo outline. The raised-wing and lowered-wing silhouettes alternate clearly at 6 fps while the body anchor remains centered.
- Native size: the generated source resolves to approximately 26×24 logical pixels and fits inside the 32×26 cell without capped-frame rescaling.
- Curation: the lowered-wing frame is snapped 1px right and 2px up so the body anchor stays stable through the two-frame loop.
- Automated correction score: **94/100**.
- Extraction note: the raw strip has mildly non-uniform block pitch between axes; the deterministic pixel-perfect detector kept the stronger grid estimate. The final frames are binary-alpha, palette-locked, and visually crisp.
