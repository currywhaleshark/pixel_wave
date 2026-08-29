# Hwii sprite QA

- Base Lock Gate: PASS — one connected circular cloud-and-eyelid overlay, stable center and silhouette, flat chroma-green outer background and eye cavity, no eyeball or detached runtime effects.
- `idle` motion continuity: PASS — open, half-close, closed, half-open frames keep the outer core stable and form one readable blink without whole-body rotation.
- Layer separation: PASS — frames 0, 1 and 3 retain a transparent eye opening; frame 2 fully covers the code-rendered eyeball. Runtime gaze and blinking are independent.
- Runtime scale: PASS — deterministic extraction targets `64×64` world pixels with a 3px safe margin; the tracked eyeball, spiral arms and tear remain code-driven.
- Pixel contract: PASS — 16 locked colors, binary alpha, no foreign colors, no isolated one-pixel components, no safe-margin touches, and no extraction pitch warnings.
- Curation status: pending human frame/order/pixel review.
