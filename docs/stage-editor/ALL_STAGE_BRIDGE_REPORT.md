# All-stage data bridge report

All seven Pixel Wave stages can be opened in the Stage Sequencer and tested in
the real game using the current editor draft. Production now uses the checked-in
Stage JSON registry by default. `?stageRuntime=legacy` keeps the frozen legacy
`Spawner` available as an immediate rollback path.

## Converted data

- Stage 1: 34 waves, 185 enemies, and 5 terrain-socket coral turrets
- Stage 2: 38 waves, 193 enemies, and authored lantern mine gardens
- Stage 3: 37 waves, 207 enemies, rear-entry/U-turn traffic, and turtle chase
- Stage 4: 35 waves, 145 enemies, darkness pulses, and 12 staged vipers
- Stage 5: 25 waves, 138/139/140 enemies by difficulty, and 10 wreck hazards
- Stage 6: 32 waves, 177 enemies, and 13 grouped lightning strikes
- Stage 7: 14 waves, 58 enemies, 2 wrecks, 3 lightning strikes, and 9 memory/synthesis phrases

All seven production stages are now hand-authored and are no longer overwritten
by `tools/convert_legacy_stages.js`. The registry builder packages the seven
checked-in production documents deterministically.

## Runtime vocabulary added

- movements: tracking, terrain-scroll turret, and current-surf;
- weapons: legacy drop shot and lantern mine;
- formation: player-centered surround ring;
- hazards: wreck corridor and lightning strike game dispatch.

The preview and real game use the same compiled fields. Surround formations are
compiled deterministically, then centered on the player's live position at the
actual spawn moment.

## Verification

For Easy, Normal, and Hard, approved Gameplay v2 counts, hazards, warning time,
boss entry, and signature replacements are checked explicitly. Representative
item overrides cover mine warning time, U-turn location/rate, viper reveal
information, ghost count, and lightning warning width/time. All stages complete
deterministic full-duration simulation with their expected boss ID. The full JS
suite and 30 Python pipeline tests run before each milestone commit.
