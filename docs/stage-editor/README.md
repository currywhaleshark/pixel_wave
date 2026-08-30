# Pixel Wave Stage Sequencer design index

The Stage Sequencer contract now has an M3 wave-authoring slice. The current game
runtime has not been replaced; the editor remains isolated under `tools/`
until preview parity is proven.

## Run M3

1. On Windows, double-click `run-stage-sequencer.bat` at the repository root.
   It starts the server and opens the editor. Alternatively run
   `python server.py` manually.
2. Open `http://localhost:8321/tools/stage-sequencer.html` on desktop or mobile.
3. Use the section chips or `IN`/`OUT` marks for a looping range, switch
   difficulty, and select a timeline clip to edit it.
4. The editor handles wave, environment, cue, and the Stage 3 turtle-ride clip. The
   inspector can edit the shared base or an Easy/Normal/Hard patch, disable a
   clip for one difficulty, and restore inheritance. New waves can target all
   difficulties or only the active difficulty.
5. Select `custom-path` as a wave's movement and apply once to create a path.
   Numbered points then appear over the preview. Drag a point directly; use the
   inspector to add/delete points and edit arrival time, easing, or hold time.
   Raw normalized coordinates stay in Stage JSON and are not exposed as form
   fields. When the active-difficulty scope is selected, path gestures create a
   difficulty patch instead of changing the shared base.
6. Wave formation controls show the resolved enemy count. The preview exposes
   an entry-position handle for ordinary waves, a V-spacing handle, and a
   wall-gap handle. Horizontal, vertical, and diagonal entries rotate formation
   previews to match their travel direction. These gestures also follow the
   selected base or difficulty scope.
7. Enemy and entry selectors use the shared registry library. Eight ordinary
   enemy kinds and all five legacy entry directions are available with Korean
   names, descriptions, and enemy defaults. Choosing a dependency not yet used
   by the stage adds its declaration in the same undoable command.
8. Timeline clips show inherited, patched, replaced, disabled, and
   active-difficulty-only states. The editor also supports duplicate/delete,
   undo/redo, Stage 3 JSON import, device autosave, and JSON export.

The simulator uses deterministic fixed steps and 5-second snapshots. The shared
`js/stage/path.js` module normalizes, validates, and samples custom paths,
`js/stage/entry.js` resolves the five screen-edge entry presets, and
`js/stage/formation.js` resolves direction-aware V spacing, wall gaps, and enemy
counts for both the compiler and editor. It previews spawns, movement, legacy
enemy fire, Stage 3's turtle ride, background scroll changes, warning, and boss
entry. Player input, collision, damage, and live game-runtime replacement
remain intentionally outside this slice.

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

M1's read-only mobile Stage 3 player is complete. M2 includes command
history, device persistence, JSON import/export, timeline dragging, difficulty
patch authoring, difficulty-only waves, and focused turtle-ride controls. Clip
resize handles and generic registry-generated advanced fields remain for later
slices. M3 now includes native custom-path data,
shared deterministic sampling, direct desktop/touch point dragging, point
timing/easing/hold controls, coalesced undo, and difficulty-specific paths. Its
formation slice adds entry-direction authoring, shared V/wall layout rules,
resolved-count feedback, and direct desktop/touch formation handles. The enemy
and entry library slice adds eight ordinary enemy definitions, all five legacy
entry directions, direction-aware formation rotation, and atomic dependency
declarations. Movement/weapon metadata, Barrage Lab handoff, and budget overlays
are still pending.
