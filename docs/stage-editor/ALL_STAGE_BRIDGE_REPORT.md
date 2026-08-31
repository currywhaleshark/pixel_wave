# All-stage data bridge report

All seven Pixel Wave stages can now be opened in the Stage Sequencer and tested
in the real game using the current editor draft. Production URLs still use the
legacy `Spawner` unless `debug&stageRuntime=data` is present.

## Converted data

- Stage 1: 38 waves, 189 resolved enemies
- Stage 2: 38 waves, 193 resolved enemies
- Stage 3: 37 waves, 207 resolved enemies, turtle ride
- Stage 4: 39 waves, 170 resolved enemies, darkness
- Stage 5: 31 combat waves, 162 resolved enemies, 11 wreck hazards
- Stage 6: 35 waves, 187 resolved enemies, 16 lightning hazards
- Stage 7: 34 combat waves, 191 resolved enemies, 2 wreck and 6 lightning hazards

The deterministic converter is `tools/convert_legacy_stages.js`. Stage 3 stays
hand-authored; the converter owns Stages 1, 2, 4, 5, 6, and 7. The production
registry builder packages all seven checked-in drafts.

## Runtime vocabulary added

- movements: tracking, terrain-scroll turret, and current-surf;
- weapons: legacy drop shot and lantern mine;
- formation: player-centered surround ring;
- hazards: wreck corridor and lightning strike game dispatch.

The preview and real game use the same compiled fields. Surround formations are
compiled deterministically, then centered on the player's live position at the
actual spawn moment.

## Verification

For Easy, Normal, and Hard, every stage matches the legacy ordered wave start
times and resolved counts. Wreck counts/times, lightning positions/times,
warning time, boss entry, and the Stage 3 turtle ride are checked separately.
All stages also complete deterministic full-duration simulation with their
expected boss ID.
