# Architecture

## Core decision

A draft is not merely a hidden blank Session, and it is not merely a JSON task. It combines both:

```text
DraftRecord (unsent text authority)
        │
        └── sessionId ──► real blank DSH Session (execution shell)
```

DSH may recreate or hide blank Sessions, so the unsent prompt must not live only in Session state. At the same time, a real Session is needed for the standard model, agent preset, and permission surfaces.

## Components

### DraftStore

The Host owns a versioned JSON document. Every operation runs through one serialized queue. Mutations write a same-directory temporary file and rename it into place before the in-memory snapshot changes.

`revision` is record-local. An update supplies `expectedRevision`; a mismatch rejects the entire mutation.

### Remote boundary

The Web client mounts a strict Typert contribution for:

- `draftSessions.list`
- `draftSessions.create`
- `draftSessions.update`
- `draftSessions.delete`
- `draftSessions.rebind`

Input and output codecs reject unknown or malformed boundary values. The Host service uses the same method names through `TypertRemoteService`.

### Session lifecycle bridge

`DraftSessionLifecycle` first persists a DraftRecord without a Session id, then calls `sessions.create({ workspaceId })`, and finally stores the returned id through `rebind`. A failed Session creation marks the record as an error but leaves its text durable. `ensureShell` and `reconcileWorkspace` compare stored ids with `sessions.list()` and create replacements for missing shells.

The bridge never uses Workspace connection semantics that intentionally reuse an existing blank Session: independent drafts require independent Session ids. Optimistic revisions serialize competing recovery attempts, and a successful rebind clears an earlier materialization error.

The lifecycle observes the public API client's RPC envelopes and correlates `session.prompt` requests with their responses by `rpcId`. A successful response schedules finalization, but the DraftRecord is deleted only after `sessions.list()` reports that exact Session as `blank: false`. A rejected response does nothing. Workspace reconciliation applies the same monotonic `blank: false` proof after reload or reconnect, when the original response envelope is no longer available.

### Composer bridge

`DraftComposerBridge.open` first flushes and detaches the previous draft, ensures the target Session shell, opens it through the runtime, and restores the exact Host text through `conversation.input.for(scope).setDraft()`. It then subscribes to the official per-session input state.

Ordinary edits use a 350 ms debounce and serialized optimistic `draftSessions.update` calls. An edit arriving during an in-flight save is sent with the revision returned by that save. Navigation waits for the queue to drain before opening another Session; a remote revision conflict is shown through the owning composer and blocks the switch, so text from two drafts cannot cross.

`DraftShortcutController` owns the global `Ctrl/Cmd + Shift + N` action. It resolves the current Session's Workspace, falling back to the runtime's recent Workspace, flushes the active composer, and then creates and opens a distinct lifecycle draft. One creation may be in flight at a time.

### Composable workspace sidebar

The Harness sidebar owns an additive root-scoped `sidebar.workspaces.before` list slot immediately before its single `sidebar.workspaces` occupant. `dsh-draft-sessions` registers `DraftSidebarView` into that list through declaration-aware `slots.inject()`. The stock browser, Archive Manager replacement, or another deployment browser remains the sole occupant and retains search, dialogs, ordering, ordinary rows, and child declarations.

Each DraftRecord still owns a blank execution Session. The plugin contributes their ids to `slots.excludeSessionRows("sidebar.workspaces", source)`. Harness unions all contributors and projects `useSessions` plus `useWorkspaces` only for that slot, removing duplicate shell rows and their Workspace membership without changing the object layers or current Session provider. The additive draft component reads the unprojected standard hooks, so it can highlight and operate on the current draft while the composer remains session-bound.

Both integrations wait for their owner declarations independently, so Loader and client activation order do not affect the result. The plugin does not inspect `sidebar.workspaces` entries, change priority, disable `ui-workspace`, copy an occupant's store or child declarations, or embed another client bundle. Harness builds without the additive slot and exclusion API fail at activation with an explicit compatibility error.

The draft view places pinned and manually ordered DraftRecords before the browser, retains shell-less or errored drafts as actionable rows, and normalizes reorder updates to stable zero-based positions with optimistic revisions.

## Recovery rules

| Condition                              | Action                              |
| -------------------------------------- | ----------------------------------- |
| Draft and Session both exist           | Open Session and restore text       |
| Draft exists, Session is missing       | Create a blank Session and `rebind` |
| First prompt is rejected               | Keep the draft unchanged            |
| Session changes from blank to nonblank | Delete only the DraftRecord         |
| User deletes a draft                   | Delete only the DraftRecord in v1   |

The plugin intentionally leaves blank Session cleanup to DSH in v1.

## Storage and trust boundary

The default path is:

```text
$DSH_HOME/storages/dsh-draft-sessions/drafts.json
```

The schema is strict because this is a durable/file boundary. A malformed file is reported as `DRAFT_STORAGE_INVALID`; it is never replaced with an empty document automatically.
