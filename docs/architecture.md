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

Opening a draft will first open its backing Session, then restore text through DSH's official composer draft API. Autosave will debounce ordinary edits but flush before navigation so text from two Sessions cannot cross.

### Workspace browser replacement

The stock workspace browser intentionally hides every blank Session except the current placeholder and does not expose a public row extension seam. Exact Cursor-like placement therefore needs a thin, version-tracked replacement of the presentation package. Session, Agent, persistence, and prompt execution remain upstream DSH services.

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
