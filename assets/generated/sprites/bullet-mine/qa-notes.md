# Motion QA

- `blink`: **pass with static-source exception** — isotropic k-centroid extraction restores a 10×10 round content bbox instead of the former 7×10 vertical shape.
- Two runtime timing frames still reference the same stable curated frame; urgency flashing remains controlled by game timing/effects.
- Pixel lint: binary alpha, locked five-color palette, no isolated pixels, no extraction-pitch warnings, and bbox aspect ratio 1.0.
