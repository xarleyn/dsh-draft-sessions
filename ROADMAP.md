# Roadmap

## Milestone 1 — durable core

- [x] Versioned `DraftSession` schema
- [x] Host-backed JSON persistence
- [x] Serialized atomic writes
- [x] CRUD, ordering, limits, and optimistic revisions
- [x] Strict Typert Remote Client contribution
- [x] Unit tests and package build

## Milestone 2 — blank Session lifecycle

- [x] Create a distinct Session with `sessions.create({ workspaceId })`
- [x] Persist `sessionId` only after successful creation
- [x] Detect missing Session shells and rebind replacements
- [x] Observe `blank: true → false` and finalize only after accepted Send
- [x] Preserve drafts after rejected Send

## Milestone 3 — composer bridge

- [x] Restore text through the official InputHub/input actions
- [x] Debounced optimistic autosave
- [x] Flush pending autosave before switching Sessions
- [x] Surface remote revision conflicts
- [x] Add `Ctrl/Cmd + Shift + N`

## Milestone 4 — sidebar integration

- [ ] Track the current `ui-workspace` package version
- [ ] Add draft nodes above ordinary Session rows
- [ ] Muted state, context menu, keyboard navigation, and drag reorder
- [ ] Preserve all upstream ordinary Session behavior
- [ ] Document the compatibility fallback if replacement activation fails

## Milestone 5 — compatibility and release

- [ ] Browser reload E2E
- [ ] Host restart/rebind E2E
- [ ] Accepted/rejected Send E2E
- [ ] Windows, macOS, and Linux smoke runs
- [ ] Packed-install smoke test
- [ ] Compatibility matrix across supported DSH releases
- [ ] `0.1.0` release
