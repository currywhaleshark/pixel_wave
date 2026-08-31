# Pixel Wave Stage Gameplay Rework Plan v1

Status: implementation in progress; G0 and G1 complete

Date: 2026-08-31

Scope: Stage 1–7 enemy placement, stage gimmicks, difficulty differentiation,
and Boss 3–7 signature-pattern additions

This document is the canonical gameplay plan for the next Stage Sequencer
content pass. It preserves the decisions made after reviewing all seven current
Stage JSON files, the legacy runtime, the shared stage compiler/simulator, and
Boss 3–7 implementations.

The existing Stage Sequencer roadmap describes the authoring tool. This document
describes the gameplay that will be authored with it.

## 1. Goal

Give every stage a memorable mechanical identity without forcing that one
mechanic continuously for the entire stage.

The intended structure is:

```text
introduce the signature
→ leave it for contrast
→ return with one supporting element
→ present one strong combined set piece
→ release pressure before the boss
→ let the boss complete the stage's grammar
```

The rework should improve:

- stage-to-stage identity;
- readability and fairness;
- visual rhythm;
- difficulty differences that are not based only on reflexes;
- the relationship between each stage and its boss;
- deterministic authoring and reproducible playtests.

It should not simply add more enemies, bullets, hazards, or boss phases.

## 2. Locked stage identities

| Stage | Identity | Boss payoff |
|---|---|---|
| 1. 산호 초입 | Terrain-bound coral turrets and ring artillery | 팡팡 completes the ring-fire grammar |
| 2. 해파리 초원 | Lantern mines that reserve and release space | 몽실 creates a deliberate mine garden |
| 3. 거북이 고속도로 | Speed, overtaking, U-turns, and charge attacks | 씽씽 becomes a taxi-assisted chase |
| 4. 심해 협곡 | Darkness, mobile light, and delayed viper reveals | 초롱 extinguishes its lure for a timed survival intermission |
| 5. 난파선 묘지 | Wreck geometry, route choice, and phasing ghosts | 부우 combines wreck openings with ghost encirclement |
| 6. 폭풍 수면 | Telegraph-driven lightning and directional currents | 우르릉 creates strong linear undertow pulses |
| 7. 용궁 앞바다 | A curated recall and synthesis of all six stages | 휘이 controls pull, push, and rotational currents |

Bosses 1 and 2 are already mechanically coherent and should receive only
readability, timing, and presentation polish unless playtesting finds a concrete
problem.

## 3. Current baseline and why it needs a pass

The checked-in Stage JSON currently contains:

| Stage | Ordinary waves | Signature-content concentration |
|---|---:|---|
| 1 | 38 | 3 turret waves; the first turret appears at 45 seconds |
| 2 | 38 | 6 lantern waves inside 20 jelly waves |
| 3 | 37 | 28 fish waves; 26 use sine movement |
| 4 | 39 | 23 vipers across 7 waves and 12 lanterns across 8 waves |
| 5 | 31 | 61 ghosts across 10 waves plus 11 wreck hazards |
| 6 | 35 | a full-stage current plus 16 lightning strikes |
| 7 | 34 | brief samples of most systems, but weakly grouped as memories |

Several stages reuse the same underlying rhythm:

- a wave approximately every three seconds;
- column formations with sine movement;
- two generic big enemies at comparable positions;
- a wall-gap or aimed-wave combination late in the stage;
- two fast, non-shooting fish schools immediately before the boss.

The signature systems exist, but many appear as insertions into a common wave
template instead of driving the act structure. The rework should remove
repetition before adding content.

## 4. Shared pacing rules

The existing three-act section model can remain, but each act should contain
clear internal beats.

| Approximate time | Function |
|---:|---|
| 0–12 s | Scenic opening and low-risk movement |
| 12–32 s | Teach the signature system in isolation |
| 32–50 s | Contrast: use a different enemy grammar |
| 50–78 s | Return to the signature with one supporting rule |
| 78–106 s | One or two signature set pieces at full expression |
| 106 s–warning | Recovery, resource gain, and emotional transition |

Stage 3 is the main exception because its existing 35–57 second turtle ride is
worth preserving as the center of the stage.

### 4.1 Cognitive-load ceiling

At most two primary rules should demand attention at once:

1. one movement or space rule: darkness, current, obstacle, or minefield;
2. one attack rule: ring, aimed fire, charge, or encirclement.

Lightning counts as a movement/space rule. For example, wrecks + mines +
lightning must not run simultaneously.

### 4.2 Signature-frequency guardrails

- Introduce the stage signature by 25 seconds.
- Use approximately three to five meaningful signature set pieces.
- Do not keep the same signature pressure active for more than about 18 seconds
  without a contrast or recovery beat.
- Prefer fewer authored set pieces over many interchangeable waves.
- Leave at least five seconds of recovery before the boss warning.
- Replace the repeated generic final fish pair with a stage-specific farewell or
  farming beat.

### 4.3 Fairness and telegraphing

- A fully hidden enemy must not collide, fire, be auto-targeted, or influence
  homing behavior.
- A newly revealed hazard remains harmless during its readable telegraph.
- A current may not change direction between a lightning telegraph and the end
  of that strike.
- A wreck must cast a readable edge shadow or other entry cue before collision.
- Rear-entry and U-turn enemies need edge arrows, wake trails, or braking spray.
- Randomness may choose between known safe layouts, but it must not decide
  whether a safe route exists.

Initial minimum warning guidance:

| Difficulty | Sudden-body/hazard warning |
|---|---:|
| Easy | about 0.8 s or longer |
| Normal | about 0.6 s or longer |
| Hard | never below about 0.45 s |

These are starting values and require playtesting at the native 480×270 world
resolution.

## 5. Difficulty strategy

Normal is the reference playthrough. Easy and Hard should change the rule or
topology of a pattern instead of applying every numerical pressure at once.

### Easy

- one fewer simultaneous source;
- wider route or safe gap;
- earlier reveal and longer telegraph;
- fewer overlaps, while retaining every stage's signature mechanic.

### Normal

- complete signature combinations;
- two readable systems at most;
- intended baseline timing and geometry.

### Hard

- phase shifts, reversed order, crossing routes, or staggered sources;
- shorter but still fair telegraphs;
- only modest speed increases;
- no unstructured random residue added merely to increase density.

The current global Hard profile already combines approximately 2.08 times the
Easy firing frequency, +22% bullet speed, +4 ring bullets, +55% boss HP, and
other multipliers. Adding authored Hard layouts on top of all of these would
over-amplify difficulty. The global profile must be reviewed during the
difficulty pass.

In particular, the current Hard-only random scatter added to ordinary ring fire
should be replaced with an authored phase-shifted second ring or another
readable geometric change.

## 6. Stage plans

### 6.1 Stage 1 — 산호 초입

Signature: coral turrets attached to real foreground terrain, firing readable
ring artillery.

#### Intended sequence

1. 0–10 s: non-shooting upper and lower fish schools teach movement and shot
   alignment.
2. 10–20 s: one turret on a distinctive terrain height fires a slow 6–8 bullet
   ring in open space.
3. 20–32 s: wall-gap fish and jelly rain provide a non-turret contrast.
4. 35–45 s: rays and one big enemy use aimed or fan fire; rings remain strongly
   associated with turrets.
5. 45–58 s: a low turret with upper traffic, followed by a high turret with
   lower traffic. Their ring phases differ.
6. 60–73 s: jelly rain and rays give a complete artillery break.
7. 76–88 s: two turrets arrive four to six seconds apart. Killing one first
   visibly opens the route.
8. 90–100 s: wall-gap and aimed formations without turrets.
9. 102–106 s: non-shooting, stage-themed farming farewell.

#### Required changes

- Promote the approved Stage 1 terrain sockets from the terrain coverage
  fixture into the production Stage 1 document.
- Use distance-domain terrain objects instead of hand-authored wave Y values.
- Add turret charge feedback and an authored ring phase/gap.
- Reduce generic big-enemy ring usage so the turret remains the memorable ring
  source.

#### Boss 1

Keep the current phase structure. Polish P2 ring origins and phase offsets so
the boss reads as the final form of coral artillery.

### 6.2 Stage 2 — 해파리 초원

Signature: lantern enemies deliberately place timed mines that reshape the
future safe area.

#### Intended sequence

1. 0–12 s: vertical jelly movement; no mines.
2. 13–24 s: one lantern places one or two mines with a generous fuse.
3. 24–34 s: jelly drops cross a moving lantern's mine trail.
4. 35–48 s: three lanterns produce one recognizable mine-garden set piece, with
   only one type of supporting jelly.
5. 50–59 s: a complete non-mine break using fish or one big enemy.
6. 60–73 s: a stationary lantern reserves a point while upper/lower jelly
   movement changes the escape route.
7. 76–88 s: a bright jelly field with no mines.
8. 90–99 s: upper and lower lanterns detonate in a planned order, moving the
   safe area from center to upper/lower space.
9. 102–106 s: non-shooting luminous farming parade.

#### Required changes

Promote these mine values into authored weapon parameters:

- fuse duration;
- explosion ring count;
- ring phase/start angle;
- placement/detonation stagger;
- countdown flash and sound timing.

Mine layouts must be deterministic for a fixed stage seed. Random ring phase
must not destroy an authored safe route.

#### Boss 2

Keep the current curtain, mine placement, and mine-garden phases. Restrict work
to timing, readability, and deterministic layout polish.

### 6.3 Stage 3 — 거북이 고속도로

Signature: speed and route reading rather than dense stationary bullet dodging.

#### Intended sequence

1. 0–10 s: fast upper/lower traffic and a ray checkpoint.
2. 10–20 s: first rear overtake and first U-turn, both with explicit warnings.
3. 20–32 s: bidirectional crossings and readable lane changes.
4. 35–57 s turtle ride:
   - 35–41 s: acceleration and pearl reward;
   - 41–49 s: slalom through fast non-shooting traffic;
   - 49–55 s: glimpse and pursue 씽씽's silhouette or escorts;
   - 55–57 s: deceleration.
5. 57–62 s: clear recovery beat.
6. 62–75 s: medium-speed rays and death-shot introduction for contrast.
7. 75–89 s: rear overtakes, U-turns, and telegraphed custom-path charges.
8. 90–100 s: a traffic-construction wall and one moving big enemy.
9. 101–111 s: bidirectional high-speed finale and farming line.

#### Required changes

- Rear-entry edge warning.
- U-turn braking spray and curved wake.
- Less repetitive sine-column traffic during the ride.
- Boss-specific turtle-ride options instead of reusing the fully invulnerable
  bonus ride unchanged.

#### Boss 3

Keep the current dash, lane-traffic, overtake, and Hard round-trip patterns.
Add one 8–10 second transition between P2 and P3:

1. the turtle taxi arrives;
2. 씽씽 flees near the front of the screen;
3. the player steers through lane hazards and escorts while attacking;
4. the taxi exits and P3 begins.

The boss chase should use limited protection or two to three taxi durability
segments, not unconditional invulnerability.

### 6.4 Stage 4 — 심해 협곡

Signature: controlled darkness, mobile light, and predators that reveal their
position before they begin hunting.

#### Intended sequence

1. 0–10 s: darkness gradually deepens from roughly 0.55 to 0.70; one lantern and
   non-shooting fish explain the light system.
2. 11–18 s: one unlit viper approaches, flashes its eyes, then begins tracking.
3. 20–27 s: two vipers reveal sequentially from different heights.
4. 28–35 s: a jelly wall's safe gap is visible inside lantern light, followed
   by two to three seconds of empty space.
5. 35–45 s: two lanterns at different heights let the player choose a bright
   route.
6. 45–53 s: one bright-space large-enemy fight using an aimed fan instead of a
   Stage 1-like ring.
7. 54–63 s: the stage brightens temporarily for a full darkness break.
8. 64–76 s: a parked lantern and three sequential upper/middle/lower viper
   reveals.
9. 76–87 s: darkness reaches roughly 0.86–0.90; one jelly gap and one viper are
   combined, without additional aimed fire before the reveal.
10. 88–98 s: a bright contrast fight.
11. 99–108 s: four vipers reveal 0.6–0.8 seconds apart, followed by one fast
    fish sweep.
12. 108 s–warning: enemies clear; the lantern recedes and darkness deepens for
    the boss entrance.

Target content after reduction:

- approximately 12–15 vipers instead of 23;
- approximately 6–8 lanterns instead of 12.

#### Viper state machine

```text
unlit → glint → hunt → leave
```

`unlit`:

- no eye glow or darkness-mask light hole;
- low body silhouette only;
- straight, quiet approach;
- no tracking, collision, firing, damage target, homing target, or dolphin
  target.

`glint`:

- eyes flash twice;
- short sound cue;
- heading becomes readable;
- remains non-colliding for approximately 0.45–0.65 seconds.

`hunt`:

- body and eye light become visible;
- current gentle tracking begins;
- collision and targeting become active;
- tracking eventually ends in a straight exit.

If hit while unlit, the viper reveals immediately. Easy reveals earlier and
telegraphs longer. Hard should use entry angle and time offsets rather than
large speed or turn-rate increases.

The Stage Registry currently describes `viper` as `부우`; it must be corrected
to `독니고기`.

#### Boss 4

Keep dark fishing, lit ring/lantern play, and the star-night finale. Add one
non-repeating transition between P2 and the star finale:

1. slow stars appear and provide sparse light;
2. 초롱's lure dims in three readable steps;
3. the lure turns off, the boss hides, and `hittable` becomes false;
4. an eight-second survival timer begins;
5. 3/4/5 vipers reveal sequentially on Easy/Normal/Hard;
6. killing a viper removes about 0.7 seconds or leaves a small temporary light;
7. the lure relights, remaining vipers clear, and the star-night phase begins.

This is a single dramatic intermission, not a repeated invulnerable loop.

### 6.5 Stage 5 — 난파선 묘지

Signature: wreck geometry creates route choices while ghosts ignore that
geometry and materialize on the selected route.

#### Intended sequence

1. 0–8 s: open water and ordinary fish show the background.
2. 8–16 s: one lower wreck enters with shadow, bubbles, and creaking warning.
3. 16–24 s: one upper wreck; translucent ghosts pass through it and materialize
   inside the route.
4. 25–32 s: diagonal ghosts without wrecks teach ghost timing alone.
5. 32–35 s: recovery.
6. 35–44 s: upper/lower hull pieces create a wide central corridor, initially
   with non-shooting fish.
7. 45–54 s: four ghosts cross the hull and materialize sequentially.
8. 55–61 s: open-space fight with no wreck or ghost signature pressure.
9. 62–75 s: a large lower wreck pushes the player upward; the first ghost
   surround leaves a gap aligned with that route.
10. 76–90 s: large `top → bottom → top` wreck slalom with adequate turn time.
11. 91–99 s: second open-space ghost surround, using staggered materialization
    to leave a temporary side route.
12. 100–111 s: central wreck corridor followed by six ghosts passing through
    the hull into the corridor; only one ordinary fast fish line remains.

Target content after reduction:

- approximately 6 meaningful ghost waves and 32–40 ghosts instead of 61;
- 8–9 wreck objects grouped into three set pieces instead of 11 isolated
  repetitions.

The current Stage 5 coral turrets should be removed or replaced with a wreck
weapon/emergence event so Stage 1 retains turret ownership.

#### Ghost state and grouping

- Start with approximately 0.8 seconds translucent and harmless.
- Flash a bright outline for approximately 0.2 seconds before solidity.
- Remain solid for approximately 1.6 seconds.
- Support synchronized phase for a wall and staggered phase for a procession.
- Allow a deterministic per-wave phase offset.

#### Wreck variants

- Preserve several authored hull silhouettes/heights.
- Add a `variant` value instead of deriving all appearance implicitly.
- Ensure rendering tiles to the authored collision width before widening wrecks.
- Optional destructible weak boards may be added later, but are not required
  for the first placement pass.

#### Boss 5

Keep P1 hide-and-seek and the existing long-body parade.

- P2: the exit hole determines whether an upper or lower wreck passes, leaving
  the opposite route safe; two or three ghosts then pass through it and
  materialize.
- P3 alternates between the body sweep and a wreck/ghost-route set piece.
- Never combine the body sweep, a narrow wreck, and a complete ghost surround
  at the same moment.

### 6.6 Stage 6 — 폭풍 수면

Signature: currents create an anticipated displacement, and lightning tests the
route chosen under that current.

#### Intended sequence

1. 0–13 s: current-surf fish and particles show the flow; no lightning or
   shooting.
2. 13–30 s: two isolated left/right lightning strikes. The current locks during
   every telegraph and strike.
3. 30–48 s: one two-strike sequence plus either stationary rays or a ring source
   to show bullets bending in the current, not both at high density.
4. 48–57 s: a calm eye with weak current and resource recovery.
5. 57–77 s: a visible current reversal followed by a three-strike sweep and
   surfing fish.
6. 77–96 s: paired lightning creates either a central or outer safe route,
   followed by ray fire.
7. 96–108 s: one four-strike `.2 → .4 → .6 → .8` wave or its reverse. Reduce
   ordinary shooting so lightning remains the subject.
8. 108–111 s: current and enemies briefly subside before the boss warning.

Reduce the current 16 lightning clips to approximately 11–13 strikes grouped
into clearly different single, pair, and sweep sentences.

#### Boss 6

Keep the beam, lightning-call, great-storm, and Hard twin-beam structure. Add a
linear undertow cycle to the great storm:

1. particles and current indicator collect for about 0.7 seconds;
2. a 1.2 second linear current pulls the whole screen in one direction;
3. a lightning sweep arrives from the opposite side;
4. one second of recovery;
5. repeat in the other direction.

Sustained player force should begin around 70–90 px/s. The effect should feel
strong through waves, particles, and bullet curvature, rather than by making
low-speed player movement impossible.

우르릉 owns linear current. 휘이 owns radial and rotational current.

### 6.7 Stage 7 — 용궁 앞바다

Signature: a readable journey recap, followed by pairwise synthesis. It must not
be a simultaneous pile of every previous system.

#### Intended sequence

| Time | Memory or synthesis |
|---:|---|
| 0–12 s | Stage 1: one terrain-bound coral turret and slow ring |
| 12–24 s | Stage 2: lantern mines create an advance route |
| 24–36 s | Stage 3: fast pass-through and U-turn traffic with little shooting |
| 36–48 s | Stage 4: short darkness pulse and unlit viper reveal |
| 48–62 s | Stage 5: one wreck opening and a partial ghost encirclement |
| 62–76 s | Stage 6: stronger current followed by single and paired lightning |
| 76–86 s | Synthesis A: coral rings bend in a weak current |
| 86–97 s | Synthesis B: fast enemies travel through the route left by lantern mines |
| 97–106 s | Synthesis C: wreck exits, ghosts appear, then lightning follows sequentially |
| 106–111 s | Quiet return: ordinary fish, pearls, and weakening current |

Stage 1 recall must use a real turret, not a generic big-enemy ring. Stage 4
recall must include darkness, not only a viper.

A future `section-transition` cue may clear residual bullets to pearls and
change color/audio between memories. It is optional for the first gameplay pass
but would make the recall structure visually explicit.

#### Boss 7

The current boss already has pull, left/right push, an outward storm eye, and a
moving Hard safe center. Add a real rotational flow to the late phase.

For player position `p` and boss center `c`:

```text
r = normalize(p - c)
t = perpendicular(r)
force = r * radialStrength + t * tangentialStrength
```

Recommended phase language:

- P1: inward pull with spiral lanes;
- P2: `pull → pause → push` breathing rhythm;
- P3: tangential rotation plus weak radial push;
- P4: the rotating safe eye moves on a large orbit without repeatedly reversing
  rotation direction.

The final boss represents the whole journey through force and composition. It
does not need to replay every ordinary stage hazard at once.

## 7. Shared gameplay grammar changes

### 7.1 Coral turret

- Terrain socket anchor.
- Charge cue.
- Authored ring phase and optional gap.
- Difficulty changes source timing/phase, not random residue.

### 7.2 Lantern mine

- Authored fuse, count, phase, and stagger.
- Deterministic safe-route layout.
- Visible and audible countdown.

### 7.3 Fast and rear-entry enemies

- Edge warning before rear entry.
- Speed wake/trail.
- Brake cue before U-turn.
- Prefer non-shooting movement puzzles when speed itself is the challenge.

### 7.4 Viper

- `unlit → glint → hunt` state machine.
- Hidden state excluded from every collision and target system.
- Reveal parameters authored through `enemy.params` or shared behavior metadata.

### 7.5 Ghost

- Harmless translucent entry.
- Materialization outline cue.
- Group phase and phase-offset authoring.

### 7.6 Wreck

- Explicit visual variant and entry cue.
- Collision width must match rendered width.
- Reusable hazard spawn path for stages and Boss 5.

### 7.7 Current and lightning

- Stage current can be pulsed and changed by authored clips.
- Lightning receives authored width, telegraph duration, and strike duration.
- A shared current sampler supports uniform, linear, radial, and tangential
  fields for the stage simulator and game runtime.

### 7.8 Turtle ride

`startRide(duration, options)` or an equivalent shared contract should expose:

- scroll multiplier;
- player invulnerability or taxi durability;
- pearl trail on/off and cadence;
- bullet clear on/off;
- ride message and exit behavior.

The bonus ride and Boss 3 chase then use the same implementation with different
options.

## 8. Runtime prerequisites

These gaps must be resolved before authoring dependent placements.

1. The Stage Sequencer simulator evaluates `darkness` and `storm-current`, but
   the live `GameSpawner` does not apply the full active plugin state each
   frame. Normal gameplay still reads fixed `STAGES[].dark` and `STAGES[].storm`
   values.
2. The game adapter currently forwards only lightning `xRatio`; width,
   telegraph duration, and strike duration fall back to global constants.
3. `enemy.params` is valid in the schema but is not carried through the full
   compiler → simulator/game adapter → `Enemy` pipeline.
4. Tracking duration and turn rate remain hard-coded.
5. `startRide()` hard-codes full invulnerability, ×5 scrolling, pearl output,
   and bullet clearing.
6. The current game current is one uniform `curX/curY` vector. True Boss 7
   rotation needs a position-aware shared flow-field sampler.
7. Wreck `indestructible` and edited width are not fully represented by live
   collision/render behavior.
8. Boss choreography remains code-driven in `boss*.js`; the Stage Sequencer
   roadmap explicitly postponed general boss editing. Boss changes belong in a
   separate code slice, not fake timeline clips.
9. Production still defaults to the legacy spawner. Stage JSON edits are tested
   through the opt-in data runtime until the live bridge is complete and
   approved.

## 9. Implementation sequence

Use gameplay slices `G0` through `G7` to avoid confusing this work with the
Stage Sequencer tool milestones M1–M7.

### G0 — Planning baseline

- Check in this document.
- Treat it as the source for later stage-placement decisions.
- Record intentional deviations in its decision log before implementation.

### G1 — Live plugin/runtime bridge

- Apply active darkness and current clips to the actual game.
- Forward all lightning parameters.
- Introduce shared current sampling and target-specific influence.
- Add runtime/preview parity tests for changing environment state.

### G2 — Shared enemy and ride grammar

- [x] Carry `enemy.params` end-to-end.
- [x] Add viper reveal and ghost materialization.
- [x] Add rear-entry warning.
- [x] Add authored U-turn position and braking cue.
- [x] Parameterize tracking.
- [x] Optionize turtle rides.
- [x] Add common wreck spawning and rendering-width correctness.

### G3 — Stages 1 and 2

- [x] Promote Stage 1 terrain sockets and rebuild ring-artillery placement.
  Five production turrets now arrive at approximately 11.6, 45.5, 56.4,
  77.0, and 81.9 seconds from six approved terrain sockets. Their native
  distance anchors keep them attached to the near layer in preview, seek, and
  live data play.
- [x] Give Stage 1 rings authored phase rotation, one readable opening, and a
  charge cue. Easy/Normal/Hard resolve to 6/8/10 directions with progressively
  shorter intervals and higher turret HP, without the old random aimed/scatter
  residue.
- [x] Move generic big enemies away from Stage 1's ring identity: the mid-stage
  big enemy now uses aimed fire and the late ring-firing big enemy is removed.
- Add deterministic mine parameters and rebuild Stage 2 placement.
- Keep Bosses 1 and 2 structurally unchanged.
- Establish Normal pacing and difficulty conventions.

### G4 — Stages 3 and 4

- Rebuild high-speed and taxi rhythm.
- Add Boss 3 chase transition.
- Rebuild darkness/reveal rhythm.
- Add Boss 4 survival transition.

### G5 — Stages 5 and 6

- Rebuild wreck/ghost route set pieces.
- Add Boss 5 wreck/ghost combinations.
- Rebuild current/lightning rise and calm-eye contrast.
- Add Boss 6 linear undertow cycle.

### G6 — Stage 7 and Boss 7

- Author the six memories and three pairwise syntheses.
- Add radial/tangential current support to Boss 7.
- Preserve a quiet emotional approach to the final boss.

### G7 — Difficulty, integration, and release QA

- Add Easy/Normal/Hard item overrides.
- Review or reduce conflicting global difficulty multipliers.
- Regenerate the checked-in stage registry.
- Replace legacy-equality expectations with approved Gameplay v2 deterministic
  fixtures where gameplay is intentionally different.
- Run all unit, fixture, browser, and gameplay tests.
- Approve the data runtime as default only after rollback and save/reward paths
  are verified.

Work remains on the current feature branch. Commit coherent slices, do not merge
each slice to `main`, and create one PR after the large gameplay milestone is
complete.

## 10. Verification matrix

Every stage must be tested on Easy, Normal, and Hard.

### Structural checks

- Signature appears by 25 seconds.
- No unbroken signature-pressure run exceeds roughly 18 seconds.
- No normal encounter demands more than two primary rules.
- Recovery begins at least five seconds before boss warning.
- Stage-specific final recovery replaces generic copied endings.

### Fairness checks

- Hidden viper cannot collide, be hit, or be auto-targeted.
- Ghost cannot damage during translucent warning.
- Rear-entry warning remains visible at native resolution.
- Every wreck route has a valid player-sized opening.
- Current direction stays fixed through each lightning telegraph/strike.
- Mine detonations preserve the authored safe route for the fixed seed.

### Difficulty checks

- Easy retains the signature mechanic rather than deleting it.
- Hard changes order, geometry, or overlap before increasing speed/density.
- No Hard pattern combines all available global multipliers with an additional
  authored source unless explicitly reviewed.
- Boss invulnerable or survival intermissions do not become longer merely
  because difficulty is higher.

### Budget and presentation checks

- Use the Stage Sequencer active-budget overlay for every set piece.
- Treat 24 active enemies and 240 active hostile projectiles as initial warning
  guidance, not targets to fill continuously.
- Validate visibility against the final stage background at 480×270.
- Capture deterministic screenshots at signature introductions and climaxes.
- Test selected ranges in the actual game bridge, not only in the editor
  simulator.

## 11. Decision log

### 2026-08-31 — Initial baseline

Agreed decisions:

- Stage identities are locked as listed in section 2.
- Representative mechanics should be strong but intermittent.
- Bosses should complete their stage concept.
- Bosses 1 and 2 are kept structurally.
- Boss 3 receives a turtle-taxi chase transition.
- Boss 4 receives a one-time lights-out viper survival transition.
- Boss 5 combines wreck routes with ghost encirclement.
- Boss 6 owns strong linear current.
- Boss 7 owns pull, push, and rotation.
- Stage 4 vipers approach unlit and become dangerous only after a visible eye
  reveal.
- Stage 7 recalls mechanics individually before combining them in pairs.
- Runtime parity work precedes placements that depend on dynamic darkness,
  current, lightning parameters, enemy state, or ride options.

Open tuning questions, intentionally deferred to playtesting:

- exact enemy and projectile counts per difficulty;
- final current-force magnitudes;
- exact telegraph durations above the minimum guidance;
- whether Stage 5 receives destructible weak boards in the first pass;
- whether Stage 7 needs a dedicated section-transition cue after the base
  placement proves the recall rhythm.

### 2026-08-31 — G1 live environment bridge

Implemented decisions:

- The data `GameSpawner` now evaluates the same active plugin runtime state as
  the Stage Sequencer preview on every game frame.
- Darkness, current, scroll multiplier, surface boundary, and presentation
  flags are applied to live gameplay while the ordinary stage is active.
- A shared current sampler applies authored influence independently to the
  player, pointer target, enemy projectiles, and current-surf enemies.
- Lightning width, telegraph duration, and strike duration now reach the live
  bolt instead of falling back to global constants.
- Selected-range tests reconstruct environment state from stage start at a
  fixed 60 Hz step so a direct game test matches a full preview seek.
- Stage environment authority is released at boss start. Existing code-driven
  boss darkness and current choreography therefore remains intact until the
  dedicated Boss 3–7 slices.
- Runtime/preview parity tests cover Stage 4 darkness and Stage 6 current plus
  target-specific influence.

Deferred intentionally:

- position-aware linear, radial, and tangential fields remain part of the Boss
  6 and Boss 7 work;
- the production default remains the legacy runtime until G7 integration QA.

### 2026-08-31 — G2 enemy lifecycle foundation

Implemented decisions:

- `enemy.params` is validated, normalized, compiled, simulated, and forwarded
  to the live `Enemy` without discarding extension keys.
- Vipers now use the shared `unlit → glint → hunt → leave` lifecycle. Unlit
  and glint phases are excluded from collision, damage, homing, dolphin
  targeting, firing, tracking, and darkness-mask eye light.
- Ghosts now use `warning → outline → solid` timing instead of spawning solid.
  Only the solid phase can collide, take damage, be targeted, or fire.
- Ghost `phaseOffset` and per-spawn `phaseStep` provide deterministic grouped
  or staggered materialization.
- Tracking duration and turn rate are authored movement parameters shared by
  the preview and live game.
- The Stage Sequencer exposes enemy-specific lifecycle timing fields and shows
  the same alpha/outline phase as the runtime.
- The registry label for `viper` is corrected from the boss name `부우` to
  `독니고기`.

G2 is complete. Stage placement work can now depend on the shared enemy, ride,
and wreck grammar.

### 2026-09-01 — G2 shared wreck grammar

Implemented decisions:

- Stage hazards and future boss patterns construct wrecks through one shared
  payload normalizer and spawn-spec factory.
- Authored width and height now define spawn position, visible clipping,
  horizontal and vertical sprite tiling, player collision, and off-screen
  removal. Widening a wreck no longer leaves invisible collision at its sides.
- Wrecks begin fully outside the right edge and use an authored entry-cue
  duration before their collision rectangle reaches the playfield. The game
  and Stage Sequencer show the same boundary cue.
- Four named art variants can be selected explicitly. `auto` remains
  deterministic per clip, so seeking and replaying never changes the shape.
- `indestructible: false` now makes the wreck targetable and hittable and uses
  the authored HP; indestructible wrecks retain terrain behavior.
- Existing Stage 5 and Stage 7 clips inherit defaults without rewriting their
  source payloads. Editing one in the sequencer materializes the chosen values.

### 2026-09-01 — G2 authored U-turn point

Implemented decisions:

- `movement.params.turnX` is the normalized horizontal apex of the U-turn,
  rather than an approximate delay before reversal.
- Enemies approach at full speed, begin braking early enough to reach zero
  horizontal speed at the authored apex, then accelerate back out.
- If the authored acceleration cannot stop within the available entry distance,
  braking strength is raised only as much as required to preserve the authored
  turn point.
- The braking half emits a deterministic bubble/wake cue in the live game and
  Stage Sequencer preview.
- The Stage Sequencer exposes a numeric `회전 X 위치` control and a draggable
  `U` handle on the preview. Base and per-difficulty edit scopes use the same
  existing commit path.

### 2026-09-01 — G2 rear-entry warning

Implemented decisions:

- Every `left-to-right` wave receives one lane-specific warning before its
  first enemy appears. The default lead is 0.9 seconds.
- The warning is a native-resolution edge arrow with three countdown cells and
  an optional formation count. It communicates direction, height, and timing
  without covering the play field with text.
- `entry.params.warningEnabled` and `entry.params.warningLead` are authored in
  the Stage Sequencer. Missing values preserve the safe default, while a wave
  can explicitly disable the warning when a different telegraph owns the cue.
- The compiler emits a deterministic `entry-warning` event. Preview snapshots
  and live selected-range tests restore a warning already in progress, so
  seeking into its lead window matches continuous play.
- The warning disappears at the exact first-spawn time and remains independent
  of formation interval or enemy count.

### 2026-09-01 — G2 shared turtle-ride options

Implemented decisions:

- `StagePlugin.normalizeTurtleRide()` is the shared contract for legacy bonus
  rides, Stage JSON rides, the simulator, and future Boss 3 chase calls.
- A ride now authors scroll multiplier, full invulnerability or finite taxi
  durability, turtle and speed-line presentation, boss-transition retention,
  bullet clearing/conversion, pearl trail and ring enablement/cadence, loose
  pearl streaming, start messages, and message or silent exit.
- The existing Stage 3 bonus ride keeps its old behavior through defaults:
  ×5 scroll, full invulnerability, bullet-to-pearl clear, trail, rings, turtle,
  speed lines, and arrival/departure messages.
- A future Boss 3 chase can reuse `startRide(duration, options)` with full
  invulnerability and rewards disabled, finite visible durability enabled, and
  a silent handoff back to boss choreography.
- Taxi durability absorbs a player hit before power loss or death, gives a
  brief hit cooldown and visible durability cells, and ends the ride when
  depleted.
- Rides end silently before a boss starts unless `continueIntoBoss` is
  explicitly enabled, preventing an accidentally overlapping bonus ride from
  carrying invulnerability into a boss fight.
