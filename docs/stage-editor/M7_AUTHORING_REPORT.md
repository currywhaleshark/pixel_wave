# M7 authoring hardening report

M7 completes the Stage Sequencer roadmap without changing the production
runtime default. The editor can now handle groups, reusable fragments, and
failure recovery as ordinary authoring operations.

## Editing model

- `여러 선택` supports additive touch or mouse selection; Ctrl/Cmd and Shift
  clicks work without entering the mode.
- Bulk ±1 second movement, drag movement, and deletion are one history record.
- Clipboard fragments keep relative timing, allocate collision-safe IDs, and
  merge declared preset/plugin dependencies when pasted into another stage.
- `구간 저장` captures editable clips in the active section or IN/OUT range;
  `구간 붙이기` places the template at the current playhead.

## Recovery and compatibility

Every dirty command first writes a synchronous local recovery record, then the
normal delayed draft save uses IndexedDB with localStorage fallback. Loading
chooses the newest valid record. A full-storage failure is surfaced in the
badge while JSON export remains available. Forced reload during the 500 ms
autosave window was verified in the browser and restored both shifted clips.

Unversioned Stage JSON is explicitly migrated to schema v1 and the UI lists the
changes. Documents newer than the supported schema are refused with their
version shown. The optional synchronization conflict resolver never overwrites
divergent histories: it returns both local and remote records for external
resolution.

## Capacity and interaction verification

- `tests/test_stage_authoring_hardening.js` validates and compiles the full
  2,000-item schema limit, builds its coarse 15-second preview snapshots, then
  bulk-moves 500 clips as one undo record. Documents above 500 items skip the
  second full-stage budget pass so editing remains responsive.
- Desktop browser QA covered two-clip selection, bulk shift, undo, clipboard
  paste, and undo.
- Mobile QA at 390 × 844 verified the reorganized 44 px controls, horizontally
  scrollable timeline, visible focus rules, ARIA pressed states, and live
  selection count.
- Full JavaScript and Python regression suites remain the release gate.
