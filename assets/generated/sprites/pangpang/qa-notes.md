# Motion QA

- `idle`: **pass** — 2/2 frames preserve Pangpang's face, cream belly, pink cheeks, fins, palette, and center anchor. The second pose changes the body contour subtly at equal visual scale, and the two-frame breathing loop returns cleanly.
- Automated correction score: **94/100** after regenerating the row from the accepted 48×48 idle anchor to remove scale drift and pixel-pitch instability.
- Chroma: YCbCr extraction retained yellow, cream, and pink materials; no visible magenta residue in the composed atlas.
