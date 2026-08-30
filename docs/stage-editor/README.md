# Pixel Wave Stage Sequencer design index

The Stage Sequencer contract now has an M2 editing slice. The current game
runtime has not been replaced; the editor remains isolated under `tools/`
until preview parity is proven.

## Run M2

1. Run `python server.py` at the repository root.
2. Open `http://localhost:8321/tools/stage-sequencer.html` on desktop or mobile.
3. Use the section chips or `IN`/`OUT` marks for a looping range, switch
   difficulty, and select a timeline clip to edit it.
4. M2 edits wave, environment, cue, and the Stage 3 turtle-ride clip. The
   inspector can edit the shared base or an Easy/Normal/Hard patch, disable a
   clip for one difficulty, and restore inheritance. New waves can target all
   difficulties or only the active difficulty.
5. Timeline clips show inherited, patched, replaced, disabled, and
   active-difficulty-only states. The editor also supports duplicate/delete,
   undo/redo, Stage 3 JSON import, device autosave, and JSON export.

The simulator uses deterministic fixed steps and 5-second snapshots. It
previews spawns, movement, legacy enemy fire, Stage 3's turtle ride, background
scroll changes, warning, and boss entry. Player input, collision, damage, and
live game-runtime replacement remain intentionally outside this slice.

## Start here

1. `STAGE_SEQUENCER_ROADMAP_V1.md` — product boundary, mobile interaction,
   architecture, milestones, and acceptance criteria
2. `stage.schema.v1.json` — authored Stage JSON shape
3. `PRESET_REGISTRY_V1.md` — shared runtime and editor registry contract
4. `TERRAIN_PROFILE_V1.md` — foreground geometry, sockets, review, and transform

## Schemas

- `stage.schema.v1.json`
- `terrain-profile.schema.v1.json`
- `terrain-overrides.schema.v1.json`

## Parity and coverage fixtures

- `stage3.v1.draft.json` — complete Stage 3 draft conversion
- `coverage-stage1-terrain.v1.draft.json` — current coral turret migration
- `coverage-stage5-wreck.v1.draft.json` — all current wreck obstacles
- `coverage-stage6-storm.v1.draft.json` — current storm and lightning system
- `COVERAGE_REPORT_V1.md` — conversion results and intentional differences

## Current decision

M1's read-only mobile Stage 3 player is complete. M2 now includes command
history, device persistence, JSON import/export, timeline dragging, difficulty
patch authoring, difficulty-only waves, and focused turtle-ride controls. Clip
resize handles, generic registry-generated advanced fields, and other special
systems remain for later slices.
