# Stage 1 continuous reef generation

Provider: built-in Codex ImageGen  
Reference style: `../stage1-coral-patches/base-source.png` and the preceding accepted depth panorama  
Final source files: `sources/{far,mid,near}-long-source-v2.png`

## Far

Redraw the accepted continuous reef as an extremely shallow panoramic shelf rather than geometrically squashing it. Keep one opaque reef touching both side edges, with the complete rock and all short coral accents constrained to the bottom 10% of a perfectly uniform `#00ff00` canvas. Preserve the hard-edged, countable-pixel indigo, peach, and lavender style. No gaps, islands, detached debris, gradients, antialiasing, water, text, border, or watermark.

## Mid

Create a distinct continuous midground reef using the accepted coral vocabulary and the ultra-shallow panoramic proportions. Keep one connected rock body touching both side edges, with all medium-density short coral gardens inside the bottom 12% of a perfectly uniform `#00ff00` canvas. Redraw motifs natively short; do not squash. Preserve the locked pixel-art material language. No gaps, islands, detached debris, gradients, antialiasing, water, text, border, or watermark.

## Near

Create a distinct continuous foreground reef in the same low-band format. Keep one connected rock body touching both side edges, with dense short coral silhouettes and exactly one broad cream-and-pink ridged shell landmark integrated around 62% width, all inside the bottom 15% of a perfectly uniform `#00ff00` canvas. Redraw natively short; do not squash. No gaps, islands, detached debris, gradients, antialiasing, water, text, border, or watermark.

## Postprocess contract

`tools/build_background_strips.py` removes the green key, crops the generated reef band, normalizes it to one native 480px viewport panel, quantizes to the locked 20-color palette, fills the connected underbody, repairs the wrap bridge, creates three seamless panel variants, and writes 1440px binary-alpha strips that render at runtime scale 1.
