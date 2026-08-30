# Stage JSON v1 Coverage Report

Status: design validation plus the Stage 3 M1 read-only simulator. The current
game runtime is not yet driven by these files.

## Scope

The following current mechanics were converted into Stage JSON v1 coverage
fixtures:

- Stage 1: three coral turrets migrated from time-based M6 enemies to
  foreground-anchored `terrain-object` items.
- Stage 5: all eleven wreck obstacles migrated from fake enemy objects to
  `wreck-corridor` hazard items.
- Stage 6: the full-stage storm environment and all sixteen lightning strikes.

The existing Stage 3 full draft remains the wave and turtle-ride coverage case.

## Results

| Coverage case | Source items | Draft items | Source-field mismatches | Schema errors | Semantic errors |
|---|---:|---:|---:|---:|---:|
| Stage 1 terrain | 3 turrets | 3 terrain objects | 0 for timing-derived X, HP, fire interval | 0 | 0 |
| Stage 5 wrecks | 11 wrecks | 11 hazards | 0 | 0 | 0 |
| Stage 6 lightning | 16 bolts | 16 hazards | 0 | 0 | 0 |
| Stage 6 storm | 1 stage flag set | 1 environment clip | 0 for current amplitudes/frequencies and scale | 0 | 0 |

## Intentional migration differences

### Coral turret

Current turrets spawn at a fixed `y: 0.93` and move at `CFG.scrollSpeed`, while
the foreground near layer moves with its own parallax factor. That behavior
cannot stay attached to visible terrain.

The fixture preserves source appearance timing by converting each original time
to a near-layer distance:

```text
near layer X = spawn X + time × base scroll speed × near parallax
```

The Y coordinate is intentionally no longer preserved. It will be sampled from
`stage1-near-v1`, which does not exist yet. Until that profile is generated,
terrain alignment cannot be runtime-verified.

### Wreck duration

Current wreck lifetime is inferred from its path from X=1020 to X=-80. The
fixture stores this as the visible clip duration:

```text
duration = 1100 ÷ speed
```

The registry validator must reject a duration/speed mismatch.

### Lightning duration

Each current bolt has a 0.9 second telegraph and 0.4 second strike. The fixture
therefore stores a 1.3 second clip. The plugin validator must ensure that clip
duration equals its phase total.

## Schema changes discovered by coverage testing

1. Removed duplicate `anchor.layerX`. A terrain object's distance timing is now
   its layer-space X coordinate.
2. Replaced separate environment/gimmick dependency arrays with one
   `itemPlugins` array. The registry's `allowedTypes` enforces correct use.
3. Added registry timing policies: `authored`, `derived`, and `instant`.
4. Kept new terrain objects separate from legacy M6 movement.

## Remaining pre-runtime requirements

- Generate and validate `stage1-near-v1` from the foreground strip alpha mask.
- Use `TERRAIN_PROFILE_V1.md` as the generation contract. Stage 1 should emit a
  structural mask from its background build because visible alpha cannot
  distinguish load-bearing reef from decorative coral.
- Register `coral-turret` through the stage's `terrainObjects` dependency.
- After profile review, replace the fixture's temporary direct `floor` anchors
  with approved socket IDs. Until then the fixture validates data conversion,
  not final visual attachment.
- Define parameter schemas for every registry v1 entry.
- Expand the M1 Stage 3 registry into the production registry and add parameter
  schemas for every entry.
- Replace runtime `Math.random()` calls with the Stage Runtime RNG.
- Freeze canonical boss IDs (`pangpang`, `ssing`, `buu`, `ureu`, and others).
- Add parity traces for easy, normal, and hard.

## Verdict

Stage JSON v1 can represent the tested wave, terrain, obstacle, environment,
gimmick, cue, hazard, and boss-start cases. The only unverified spatial portion
is the coral turret's final Y alignment because the terrain profile generator
has not been designed or implemented yet.
