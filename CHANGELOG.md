# Changelog

All notable changes will be documented here. The project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

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
