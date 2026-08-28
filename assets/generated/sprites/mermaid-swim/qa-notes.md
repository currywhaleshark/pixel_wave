# Motion QA

- `swim`: **pass** — 4/4 frames preserve the pink bob, cream face, tucked arms, teal tail, and right-facing silhouette. The generated source's roughly 26–28×19–23 logical-pixel poses are now preserved at 1× inside native 36×24 cells instead of being forced into 24×16. The tail alternates through a readable up/neutral/down/return cycle; the last pose returns toward the first without a hard positional jump. No missing or extra limbs and no detached artifacts were found.
- Automated correction score: **97/100**.
- Chroma: YCbCr extraction retained the pink and teal materials; no visible green residue in the composed atlas.
- Curation: **applied** — selected playback order `2 → 0 → 2(clone) → 3`, frame offsets baked with pixel-perfect snapping, and playback adjusted to 5 fps. Three curated frames touch the declared safe margin but remain inside the 36×24 cell without clipping.
