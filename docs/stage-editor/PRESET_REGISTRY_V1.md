# Pixel Wave Stage Preset Registry v1

Status: design draft. This document defines the contract between Stage JSON, the
Stage Runtime, and the Stage Sequencer. It does not change the current game.

## 1. Boundary

Stage JSON describes **what is placed**. Registry entries define **how an ID
behaves**. The editor must never contain a second implementation of a movement,
weapon, or gimmick.

Validation has two passes:

1. `stage.schema.v1.json` validates the common document and item shapes.
2. Registry entries validate preset- and plugin-specific `params`.

This separation allows a new gimmick to be registered without changing the
root Stage JSON schema.

## 2. Registry identity and compatibility

Every stage declares both versions:

```json
{
  "schemaVersion": 1,
  "registryVersion": 1
}
```

The behavior of an ID is immutable inside one `registryVersion`. Changing the
meaning of `sine`, `wall-gap`, or `turtle-ride` requires either:

- a new ID, or
- a new registry version and a data migration.

Silent behavior changes under an existing ID are forbidden.

Stage dependencies use a single `itemPlugins` list for environment, gimmick,
hazard, cue, and boss plugins. The item's `type` and the registry entry's
`allowedTypes` determine whether a use is valid.

Terrain-bound object behavior uses the separate `terrainObjects` dependency
list. Terrain geometry uses `terrainProfiles`; the two are not interchangeable.

## 3. Shared registry entry

All entries expose the following metadata.

```js
{
  id: 'sine',
  version: 1,
  category: 'movement',
  label: '사인파 이동',
  description: '진행축을 따라 이동하며 세로로 진동한다.',
  paramsSchema: { /* JSON Schema for params */ },
  defaults: { amplitude: 30, frequency: 3 },
  editor: {
    iconId: 'movement-sine',
    color: '#55d9e8',
    gizmo: 'path-preview',
    fields: [
      { path: 'amplitude', label: '진폭', control: 'range', min: 0, max: 270, step: 1, unit: 'px' },
      { path: 'frequency', label: '진동 속도', control: 'range', min: 0, max: 20, step: 0.1 }
    ]
  },
  timingPolicy: { duration: 'derived' }
}
```

`editor` is descriptive metadata only. Runtime code must not import or depend
on editor UI code.

### Timing policy

Every item-producing registry entry declares one duration policy:

- `authored`: the user directly edits `timing.duration`.
- `derived`: duration is calculated from parameters and stored for timeline
  indexing. Validation rejects a mismatch.
- `instant`: duration must be zero.

Examples:

- A turtle ride is `authored`.
- A column wave is `derived` from `(count - 1) × interval`.
- A wreck corridor is `derived` from travel distance ÷ speed.
- A lightning strike is `derived` from telegraph + strike duration.
- A boss-start item is `instant`.

The editor may expose a friendly alternate control. For example, dragging the
end of a wreck clip changes speed and then recalculates the derived duration.

### Allowed editor controls

The first editor version supports only these controls:

- `number`
- `range`
- `toggle`
- `select`
- `color`
- `text`
- `curve`
- `point`
- `path`
- `terrain-anchor`

A field must remain editable without hover and use a touch target of at least
44 CSS pixels on mobile.

## 4. Entry preset

An entry preset converts a normalized origin and parameters into one or more
spawn origins and initial directions.

```js
registerEntry({
  id,
  version,
  paramsSchema,
  defaults,
  editor,
  compile(context, entry, spawn, formationResult)
})
```

`compile` must be pure. It returns data and must not create enemies itself.

Registry v1 entries:

| ID | Current source | Meaning |
|---|---|---|
| `right-to-left` | D1 | Enter from the right edge |
| `top-to-bottom` | D2 | Enter from the top edge |
| `bottom-to-top` | D3 | Enter from the bottom edge |
| `diagonal` | D4 | Diagonal top/bottom entry |
| `left-to-right` | D5 | Overtake from behind the player |

## 5. Formation preset

A formation preset turns a desired wave into resolved members. It owns member
offsets and spawn delays.

```js
registerFormation({
  id,
  version,
  paramsSchema,
  defaults,
  editor,
  resolve(context, spawn, formation)
})
```

The result is an array of:

```js
{
  delay: 0,
  offsetX: 0,
  offsetY: 0,
  overrides: {}
}
```

Registry v1 formations:

| ID | Current source | Required behavior |
|---|---|---|
| `single` | F1 | One or repeated independent members |
| `column` | F2 | Sequential members sharing one route and phase |
| `v` | F3 | Simultaneous V with rank offsets |
| `wall-gap` | F4 | Explicit slot count and empty contiguous gap |
| `player-ring` | F5 | Ring around the player's sampled position |
| `staggered` | F6 | Sequential members with independent placement rules |

`wall-gap` uses explicit slot semantics:

```json
{
  "slotCount": 10,
  "gapSlots": 2,
  "gapStartRange": [1, 7],
  "topPadding": 40,
  "bottomPadding": 20
}
```

The resolved enemy count is `slotCount - gapSlots`. This replaces the current
ambiguous F4 behavior where `n: 9` resolves to eight enemies.

## 6. Movement preset

A movement preset owns an enemy's positional state after spawn.

```js
registerMovement({
  id,
  version,
  paramsSchema,
  defaults,
  editor,
  createState(context, enemy, movement),
  update(context, enemy, state, dt),
  snapshot(state),
  restore(serializedState)
})
```

Registry v1 movements:

| ID | Current source | Parameters |
|---|---|---|
| `straight` | M1 | none |
| `sine` | M2 | `amplitude`, `frequency` |
| `enter-pause-exit` | M3 | `targetX`/`targetY`, `pauseDuration`, `exitMultiplier` |
| `u-turn` | M4 | `acceleration`, `maxSpeedMultiplier`, `verticalAmplitude`, `verticalFrequency` |
| `soft-homing` | M5 | tracking duration, maximum turn rate |
| `terrain-scroll` | M6 | terrain layer and anchor; legacy migration only |
| `current-surf` | M7 | amplitude, frequency, current influence |
| `custom-path` | new | ordered path points and easing |

`terrain-scroll` must not be used for new coral turrets. New terrain-bound
objects use `terrain-object` items so they share the foreground transform.

### Terrain object kind

`payload.objectId` resolves through the `terrainObjects` registry. A terrain
object kind owns sprite contact points, placement class, render order, behavior,
and snapshot support. The selected terrain profile owns only stage-image
geometry and reviewed sockets. See `TERRAIN_PROFILE_V1.md` for the full contract.

```js
registerTerrainObject({
  id,
  version,
  spriteId,
  placementClassId,
  contacts,
  render,
  paramsSchema,
  createState(context, item),
  update(context, state, dt),
  snapshot(state),
  restore(serializedState)
})
```

## 7. Weapon preset

A weapon can reference either a registered preset or a Barrage JSON pattern.

```json
{ "presetId": "legacy-aimed", "interval": 2.2 }
```

```json
{ "patternId": "curve-seeder", "startDelay": 0.8, "stopWhenLeaving": true }
```

The two references are mutually exclusive.

```js
registerWeapon({
  id,
  version,
  paramsSchema,
  defaults,
  editor,
  createState(context, enemy, weapon),
  onSpawn(context, enemy, state),
  onUpdate(context, enemy, state, dt),
  onFire(context, enemy, state),
  onDeath(context, enemy, state),
  snapshot(state),
  restore(serializedState)
})
```

The `onDeath` hook is required because current S5 is fired from
`onEnemyKilled`, not from `Enemy.shoot`.

Registry v1 weapons:

| ID | Current source | Meaning |
|---|---|---|
| `none` | S0 | No enemy weapon |
| `legacy-aimed` | S1 | Difficulty-evolving aimed fan |
| `legacy-ring` | S2 | Ring, then aimed and random additions by difficulty |
| `legacy-drop` | S3 | Difficulty-evolving falling spread |
| `legacy-mine` | S4 | Timed mine deployment |
| `legacy-death-shot` | S5 | Difficulty-evolving shot on death |

The `legacy-*` IDs preserve current behavior during migration. They may later
be replaced by Barrage JSON references after parity tests pass.

The Stage 3 M3 inspector currently exposes `interval` and `startDelay` for
`legacy-aimed` and `legacy-ring`, plus the pre-difficulty `params.count` for
`legacy-ring`. `legacy-death-shot` has no timed inspector fields because it is
triggered by enemy death rather than the ordinary update timer.

`js/stage/barrage.js` is the Stage-facing adapter for Barrage JSON. It merges
bundled and device-local patterns, validates the exclusive weapon reference,
and embeds a normalized pattern into compiler output. The Stage simulator owns
the corresponding shared `BarrageRuntime.Runner`; it serializes runner cursor,
loop, and timing state together with projectile state so a seek does not replay
a simplified editor-only weapon implementation. Barrage Lab returns a saved
pattern ID to the originating wave, base/difficulty scope, and difficulty. The
Stage command model applies that result and its dependency atomically.

## 8. Item plugin

Environment, gimmick, hazard, cue, and boss items share one lifecycle contract.

```js
registerItemPlugin({
  id,
  version,
  allowedTypes: ['gimmick'],
  paramsSchema,
  defaults,
  editor,
  channels,
  create(context, item),
  start(context, state),
  update(context, state, dt),
  stop(context, state),
  snapshot(state),
  restore(serializedState)
})
```

Registry v1 plugins:

| ID | Item type | Current source |
|---|---|---|
| `scroll-speed` | environment | `CFG.scrollSpeed` and editable multiplier curve |
| `darkness` | environment | stage `dark` flag |
| `storm-current` | environment | stage `storm` and `stormLevel` flags |
| `turtle-ride` | gimmick | `startRide` / `updateRide` |
| `lightning-strike` | hazard | timeline `bolt` |
| `wreck-corridor` | hazard | enemy kind `wreck` |
| `boss-warning` | cue | timeline `warning` |
| `boss-start` | boss | timeline `boss` |

Plugins must use services exposed by the Game Adapter. Direct access to the
global game object is forbidden.

## 9. Runtime context

Preset and plugin code receives a restricted context:

```js
{
  stageId,
  difficulty,
  clock,
  scrollDistance,
  rng,
  channels,
  player: { position, hitRadius },
  services: {
    spawnEnemy,
    spawnProjectile,
    spawnPearl,
    clearProjectiles,
    startBoss,
    showMessage,
    playSound
  }
}
```

Rules:

- `rng` is seeded by stage seed, item ID, and local event index.
- `Math.random()` is forbidden in registered runtime behavior.
- Plugins cannot retain DOM nodes, canvas contexts, audio objects, or timers.
- Snapshot state must be JSON-serializable.
- Runtime time is supplied by the Stage Runtime, never by wall-clock time.

## 10. Shared state channels

Plugins publish values to channels instead of overwriting game fields.

| Channel | Value | Combine rule |
|---|---|---|
| `world.scrollMultiplier` | number | multiply, then clamp to 0–5 |
| `world.timeScale` | number | minimum active value |
| `environment.current` | `{x,y}` | vector addition |
| `environment.darkness` | number | maximum active value |
| `environment.stormScale` | number | maximum active value |
| `player.invulnerable` | boolean | logical OR |

The final scroll calculation is:

```text
scroll delta =
background.baseScrollSpeed
× scroll-speed environment curve
× active gimmick multipliers
× dt
```

The background renderer and terrain objects consume the same accumulated
`scrollDistance`.

For a `terrain-object`, `timing.start` is the object's X coordinate in the
selected background layer's distance space. `anchor.layer` identifies that
space, while the terrain profile supplies the surface Y. A separate `layerX`
inside the anchor is intentionally forbidden because it would duplicate and
potentially contradict `timing.start`.

## 11. Difficulty resolution

The Stage Compiler resolves an item in this order:

1. Clone the base item.
2. Apply the selected difficulty `patch` or `replace`.
3. Remove the item when the resolved `enabled` value is false.
4. Validate the resolved payload against the selected registry entries.
5. Apply the global difficulty profile to supported numeric fields.
6. Pass the difficulty index to Barrage Runtime.

Patch rules:

- Objects merge recursively.
- Arrays replace as a whole.
- Missing fields inherit.
- `null` is a literal value, not deletion.
- A structural deletion requires `replace` mode.

## 12. Compiler output

The Stage Compiler returns normalized data, not live game objects.

```js
{
  metadata,
  sections,
  timeItems,
  distanceItems,
  terrainObjects,
  dependencyReport,
  warnings
}
```

All arrays are sorted deterministically by:

1. trigger position,
2. item type priority,
3. stable item ID.

## 13. Validation severity

### Error

- Invalid Stage JSON shape
- Duplicate stage, section, or item ID
- Missing dependency
- Unknown preset or plugin ID
- Plugin used with an unsupported item type
- Invalid plugin parameters
- Item outside the timeline
- Terrain object without a matching terrain profile
- Snapshot-incompatible plugin used for range preview

### Warning

- Overlapping plugins writing an exclusive channel
- Distance item unreachable because scrolling remains stopped
- Empty screen gap longer than the configured threshold
- Boss starts while ordinary waves can still be spawning
- Estimated active enemy or projectile budget exceeded
- Difficulty override has no visible effect

M3 measures this warning from the same fixed-step Stage simulation used by the
preview, not from authored spawn totals. `js/stage/budget.js` tracks current and
peak active counts with snapshot/restore support. The initial mobile guidance is
24 active enemies or 240 enemy projectiles for a warning, and 32 enemies or 360
projectiles for a critical overlay. These values are performance guidance rather
than gameplay caps: the simulator never drops entities to satisfy them. The
selected section or custom IN/OUT interval is analyzed independently, and the
overlay reports both the peak count and its simulation time.

## 14. Stage 3 parity requirements

Before Stage 3 can switch from `waves.js` to Stage JSON, tests must prove:

- 37 source waves compile with matching start times and parameters.
- The wall at 90 seconds resolves to eight enemies over ten slots.
- Turtle ride starts at 35 seconds and ends at 57 seconds.
- Ride scroll is exactly base scroll ×5, not ×25.
- Ride bullet conversion, pearl trail, pearl rings, messages, turtle drawing,
  speed lines, and invulnerability are preserved.
- Boss warning starts at 116 seconds.
- `ssing` starts at 120 seconds.
- Easy, normal, and hard preserve current legacy weapon evolution.
- A fixed seed produces identical preview and game runs.

## 15. Out of scope for v1

- User-authored JavaScript inside Stage JSON
- Arbitrary conditions or branching graphs
- Live plugin installation from exported files
- Boss phase authoring
- Reverse scrolling
- Cross-stage references
- Multiplayer or collaborative editing
