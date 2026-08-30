# Pixel Wave Stage Sequencer design index

The Stage Sequencer contract now has an M1 read-only implementation. The
current game runtime has not been replaced; the prototype is isolated under
`tools/` until preview parity is proven.

## Run M1

1. Run `python server.py` at the repository root.
2. Open `http://localhost:8321/tools/stage-sequencer.html` on desktop or mobile.
3. Use the section chips or `IN`/`OUT` marks for a looping range, switch
   difficulty, select a timeline clip for its compiled payload, or export the
   authored Stage JSON.

The M1 simulator uses deterministic fixed steps and 5-second snapshots. It
previews spawns, movement, legacy enemy fire, Stage 3's turtle ride, background
scroll changes, warning, and boss entry. Player input, collision, damage, and
live game-runtime replacement remain intentionally outside M1.

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

The first implementation milestone is now available as a read-only mobile
Stage 3 player with deterministic seek, range preview, and difficulty
switching. Editable timeline clips begin only after that preview matches the
shared game simulation.
