# Stage 4 generation prompts

Mode: built-in ImageGen. Generated sources are intermediate concept/motif inputs; runtime strips are deterministic outputs of `tools/build_stage4_background.py`.

- `sea-long-source-v1.png`: empty low-contrast midnight water with fine horizontal abyss currents and faint cold shafts; no terrain or organisms. Selected source `exec-23dc4d32-1ef1-49e3-b8d0-36fd615ee03a.png`.
- `far-long-source-v1.png`: one connected low distant canyon ridge with long clearings and sparse stone teeth on true transparency. Selected source `exec-25d24beb-45ea-46ce-82d4-7ccdd2b0b361.png`.
- `mid-long-source-v1.png`: rejected first midground draft because its cliff profile occupied too much of the playfield.
- `mid-long-source-v2.png`: redrawn as a lower connected shelf-and-spire ridge. ImageGen baked its checker preview into RGB, so the deterministic builder removes only the near-white checker cells before binary-alpha repalette. Selected source `exec-8a78e8fd-53d0-483a-810e-1b1f8f656f22.png`.
- `near-long-source-v1.png`: connected foreground canyon with long low passages, eroded shelves and one native 2–3× broad landmark on true transparency. Selected source `exec-d5154bf1-61a0-4b1c-a990-fbbb21ff5abb.png`.

Shared constraints: ultra-wide 3:1 source, uniform fine pixel pitch, connected bottom terrain, uneven silhouette height, restricted navy/cobalt/indigo/violet palette, sparse cyan mineral rims, and no fish, anglerfish, jellyfish, bubbles, wrecks, text, antialiasing, painterly gradients or micro-noise.
