# Motion QA

- `paddle`: **pass** — both 32×20 frames preserve the right-facing head, navy driver cap, broad shell platform and body anchor. The four attached flippers alternate clearly at 6 fps without moving the passenger platform.
- Base lock: **pass** — the canonical base is the extracted native-cell frame from `turtle-taxi-base-v2`; the larger generated candidate is retained only as an auditable source.
- Runtime rule: the mermaid remains a separate draw call and existing ride/collision coordinates are unchanged.
