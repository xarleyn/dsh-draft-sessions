# Changelog

All notable changes will be documented here. The project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Retargeted the development and packed-install compatibility gates to DeepSeek Harness `0.1.0-rc.7`.

### Added

- Inlined the pinned workspace implementation into the draft client bundle so disabling the stock Loader row no longer leaves a missing browser module.
- Activated draft controllers from a context explicitly injected with the dynamically mounted `remote.draftSessions` service.
- Restored the production `Ctrl/Cmd + Shift + N` listener when controller dependencies are supplied explicitly.
- Memoized draft-filtered Session and Workspace selector snapshots to prevent React external-store update loops.
- Versioned Host-backed DraftStore with atomic JSON persistence.
- CRUD, ordering, per-Workspace limits, recovery rebinding, and optimistic revisions.
- Strict Typert Remote contribution for the Web client.
- Client lifecycle bridge for distinct blank Session creation and missing-shell recovery.
- Accepted-prompt observation and blank-to-materialized DraftRecord finalization.
- Official InputHub restore and serialized debounced optimistic autosave.
- Current/recent-Workspace `Ctrl/Cmd + Shift + N` draft creation.
- Pinned and verified compatible `ui-workspace` presentation version.
- Draft-first sidebar projection with backing-shell deduplication and optimistic reorder plans.
- Guarded `ui-workspace` replacement adapter that keeps the upstream browser as its compatibility fallback.
- Initial tests, architecture documentation, specification, roadmap, and CI.
