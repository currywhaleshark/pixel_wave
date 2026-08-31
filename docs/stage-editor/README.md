# Pixel Wave Stage Sequencer design index

The Stage Sequencer now loads complete Stage JSON for all seven stages. The
production default remains the legacy runtime, while debug and editor game-test
URLs can run the matching data-driven stage through the shared game bridge.

## Run the editor

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
8. Movement and weapon selectors use shared Korean registry metadata. The
   inspector exposes only the parameters used by the selected preset: sine,
   enter/pause/exit, U-turn, aimed fire, and ring fire. Entry/pause target
   controls follow the wave's travel axis. Death-shot explains that it needs a
   kill event and therefore does not fire in the collision-free preview.
9. A wave weapon can reference a Barrage Lab pattern. Choose an existing
   pattern or create one, edit it in Barrage Lab, then use `시퀀서에 적용` to
   return to the same wave, edit scope, and difficulty. The returned change is
   one undoable command and the preview runs it through the shared
   `BarrageRuntime`, including deterministic snapshot seeking.
10. The preview's active-budget overlay reads actual fixed-step simulation
    counts. It shows current enemies/projectiles plus the selected range's peak
    and peak time. The initial mobile guidance is 24/32 active enemies and
    240/360 active enemy projectiles for warning/critical status. Changing the
    difficulty, section, or custom IN/OUT range recalculates the report.
11. Select the `기본 스크롤` environment clip to edit its speed curve. Add or
    remove interior points, select them with the arrow buttons, or drag a point
    directly in the graph. Endpoint times remain locked to the clip bounds;
    point values and interior times support the same base/difficulty scope and
    coalesced undo model as path gestures.
12. Timeline clips show inherited, patched, replaced, disabled, and
   active-difficulty-only states. The editor also supports duplicate/delete,
   undo/redo, Stage 3 JSON import, device autosave, and JSON export.
13. Append `?stage=stage1` through `?stage=stage7` to open any complete stage.
    Registered environment and hazard plugins use one metadata-driven
    inspector. Exclusive state-channel overlaps appear above the timeline; each
    warning has buttons that select and seek to both conflicting clips.
14. The separate Stage 1 M5 terrain coverage fixture remains available for
    structural-mask QA. Toggle `지형 검토`
    to see the cyan structural contour and reviewed sockets. Terrain clips are
    projected from absolute layer distance onto the timeline; their inspector
    selects approved sockets and edits offset, HP, and fire interval.
15. On every complete stage, `게임 시험` copies the current in-device draft into a
    same-tab test session, then opens the current difficulty and selected range
    in the opt-in production bridge. The HUD says `STAGE DRAFT`, and an edited
    draft is expected to report parity differences from the checked-in legacy
    timeline. A selected range returns automatically at OUT; a full run returns
    after boss victory, and the pause menu can return early. Test runs do not
    write clear rewards or scoreboard state. Direct URLs without a test payload
    still use the checked-in generated Stage JSON. Removing `stageRuntime=data`
    always restores the legacy runtime. Partial coverage fixtures remain
    preview-only and are not used by the normal stage selector.
16. M7 adds `여러 선택`, one-step bulk movement/deletion, mixed-value batch
    editing, portable clip fragments, and reusable section templates. The batch
    inspector preserves relative timing and each clip's existing settings;
    only fields explicitly touched by the author are applied to the selection.
    The whole batch is one undo command. `Ctrl/Cmd+C`, `Ctrl/Cmd+V`,
    `Ctrl/Cmd+Z`, `Shift+Ctrl/Cmd+Z`, `Delete`, and touch controls share the
    same command history. Every dirty edit writes an immediate recovery copy
    before the delayed draft save; the storage badge reports quota use and JSON
    export remains enabled if browser storage fills. Legacy unversioned imports
    show the v0 → v1 migration notice instead of silently changing data.

The simulator uses deterministic fixed steps and 5-second snapshots. The shared
`js/stage/path.js` module normalizes, validates, and samples custom paths,
`js/stage/entry.js` resolves the five screen-edge entry presets, and
`js/stage/formation.js` resolves direction-aware V spacing, wall gaps, and enemy
counts for both the compiler and editor. `js/stage/behavior.js` normalizes and
validates movement/weapon fields from the shared registry metadata. It previews spawns, movement, legacy
enemy fire, Barrage JSON through `js/stage/barrage.js`, Stage 3's turtle ride,
background scroll changes, warning, and boss entry. Player input, collision,
damage, and live game-runtime replacement
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

- `stage1.v1.draft.json` through `stage7.v1.draft.json` — complete editable stages
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
declarations. The movement/weapon slice adds parameter-aware Korean inspectors,
shared validation, axis-aware pause targets, editable U-turn motion, difficulty
patch support, and legacy-fire timing/count controls. Its Barrage Lab slice adds
existing/new pattern handoff, base or active-difficulty return, atomic dependency
declaration and undo, and shared-runtime deterministic preview. Projectile/enemy
budget tracking completes M3 with shared deterministic peak measurement,
range-aware analysis, and a compact mobile overlay. M4's first slice adds the
shared `js/stage/plugin.js` contract for plugin state channels and scroll-curve
normalization, validation, and sampling. The runtime and the direct-manipulation
curve inspector now use that one implementation. The second M4 slice registers darkness,
storm current, wreck corridor, and lightning fields, validates the Stage 5/6
fixtures without changing their payloads, and adds actionable exclusive-channel
conflict warnings. The final M4 slice runs those plugins through one deterministic
runtime state, snapshots darkness/current/hazards, and renders Stage 5 wrecks plus
Stage 6 current, telegraph, and strike states in the preview.
M5 adds a deterministic Stage 1 structural-mask generator, checked-in approved
profile and override sidecar, shared layer transform, terrain semantic lint,
review overlay, explicit coral-turret sockets, distance-to-time projection, and
snapshot-safe terrain rendering.
M6 adds the production `data/stages/stage3.v1.json`, generated browser registry,
opt-in game adapter, three-difficulty legacy/data parity diagnostics, and a
full/selected-range game test bridge. Production URLs remain on the legacy
Spawner by default.
M7 completes authoring hardening with atomic multi-item commands, cross-stage
clipboard fragments with dependency merging, section templates, synchronous
crash recovery, quota diagnostics, explicit v0 → v1 migration, accessible
selection state, and a 2,000-item limit regression. Hosted synchronization is
optional; its conflict resolver returns both immutable versions and never picks
a winner when histories diverge.

The all-stage bridge adds deterministic conversion for Stages 1, 2, 4, 5, 6,
and 7, extends the shared vocabulary for legacy drop/mine weapons, tracking,
turret/current movement, and surround formations, and connects wreck and
lightning hazards to the existing game systems. All seven stages pass ordered
timing/count/special-event parity in all three difficulties.
