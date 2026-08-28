# Motion QA

- `float`: **pass** — isotropic k-centroid extraction keeps both bell widths at 14px; total content bboxes are 14×17 and 14×15, matching the intended two-pixel compression instead of the former 11×14 / 12×19 distortion.
- Both frames preserve the pink bell, facial marks and four attached tentacles. The dome uses a symmetric broad stair-step silhouette without shifting the bell anchor.
- Pixel lint: binary alpha, locked 12-color palette, no isolated pixels, no safe-margin contact, no extraction-pitch warnings, and no frame-bbox contract violations.
