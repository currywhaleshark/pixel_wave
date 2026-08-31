# M6 Stage 3 runtime parity

Production remains on the legacy `Spawner`. The data path is opt-in only when
both `debug` and `stageRuntime=data` are present.

## Automated comparison

| Difficulty | Waves | Resolved enemies | Turtle ride | Warning | Boss | Result |
|---|---:|---:|---|---:|---:|---|
| Easy | 37 | 207 | 35–57s | 116s | 120s | PASS |
| Normal | 37 | 207 | 35–57s | 116s | 120s | PASS |
| Hard | 37 | 207 | 35–57s | 116s | 120s | PASS |

`tests/test_stage_game_adapter.js` compares the ordered legacy and compiled
waves, including start times and resolved formation counts. It also exercises
the selected-range bridge and verifies that non-debug URLs cannot enable the
data runtime.

## Manual game bridge

- Full Stage 3: `index.html?debug&stageRuntime=data&stage=stage3&diff=0`
- Selected range: append `&stageRange=35,57`
- Rollback: remove `stageRuntime=data`; no data migration is involved.

The debug HUD reports `STAGE DATA · parity OK` while the opt-in path is active.

The Sequencer's `게임 시험` button is a stricter draft bridge than these direct
URLs. It stores the currently edited Stage JSON in same-tab session storage,
launches with `stageTest=1`, labels the HUD `STAGE DRAFT`, and returns to the
Sequencer at range completion, boss victory, or manual retreat. The payload is
validated before compilation and is removed on return, so production and plain
debug URLs continue to read only the checked-in generated registry.
