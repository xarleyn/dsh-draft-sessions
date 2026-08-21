# dsh-draft-sessions

Persistent, unsent future conversations for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

`dsh-draft-sessions` is building the Cursor-like workflow where you can prepare several independent tasks, leave them unsent, and return to each task later without starting an agent.

> [!IMPORTANT]
> This repository is an early alpha. Durable storage, blank Session recovery, composer autosave, and draft-first sidebar rows are implemented. Dedicated muted row styling and final context-menu/keyboard behavior are still pending.

[Русская версия](README.ru.md) · [Specification](SPEC.md) · [Architecture](docs/architecture.md) · [Roadmap](ROADMAP.md)

## The intended experience

```text
my-project
├─ ● Fix auth middleware
├─ ◌ Add Grafana dashboards       Draft
├─ ◌ Refactor docker entrypoint   Draft
└─ ● Implement notifications
```

Each draft owns a real blank DSH Session, but its unsent text is stored separately on the Host. If that blank Session disappears after a restart, a new shell can be created and rebound without losing the task.

```mermaid
flowchart LR
  UI["Sidebar draft row"] --> Composer["Standard DSH composer"]
  Composer --> Draft["DraftRecord — text authority"]
  Draft --> Session["Real blank DSH Session"]
  Session -->|"first prompt accepted"| Normal["Normal DSH Session"]
```

## What works now

- Host-backed JSON persistence under `$DSH_HOME/storages/dsh-draft-sessions/drafts.json`.
- Strict typed `draftSessions.list/create/update/delete/rebind` Remote methods.
- Independent workspace ordering and a configurable per-workspace limit.
- Optimistic revisions that reject stale browser writes.
- Atomic same-directory writes and strict durable-file validation.
- Distinct blank Session creation with the id persisted only after success.
- Missing Session detection and recovery rebinding without changing draft text.
- Accepted-Send observation with finalization only after `blank: false`.
- Rejected Send and blank slash-command preservation.
- Exact composer restore through the official per-session InputHub facade.
- Debounced optimistic autosave with a mandatory pre-switch flush.
- `Ctrl/Cmd + Shift + N` creation in the current or recent Workspace.
- Draft shells projected before ordinary Session rows through the pinned upstream workspace browser.
- Compatibility fallback to the untouched upstream browser when replacement activation is unsafe.
- Unit coverage for persistence, concurrency, limits, deletion, and recovery.

The current implementation deliberately does not send prompts, modify ordinary Session history, or delete blank Sessions.

## Requirements

- Node.js `^22.19.0` or `>=24.0.0`
- pnpm 11
- DeepSeek Harness `next`, currently `>=0.1.1-rc.2 <0.2.0`

The `next` requirement is intentional: the plugin uses the current Typert Remote API published by DSH.

## Development

```bash
cd dsh-draft-sessions
pnpm install
pnpm check
```

Build and link the checkout into a Web profile:

```bash
pnpm build
dsh plugin --profile web add .
dsh --profile web --dump-config
```

For a GitHub installation, DSH also supports `dsh plugin --profile web add github:owner/dsh-draft-sessions`. Because Git dependencies build from source, pnpm will require the user to allow this package's `prepare` script. Prefer an npm release or packed tarball when you do not want install-time build permission.

Remove the linked package with:

```bash
dsh plugin --profile web remove dsh-draft-sessions
```

## Configuration

The bundle inserts the `draft-sessions` Cordis row. Override it from the profile patch when needed:

```yaml
- id: draft-sessions
  config:
    # Blank uses $DSH_HOME/storages/dsh-draft-sessions/drafts.json
    storagePath: ""
    maxDraftsPerWorkspace: 50
```

## Current API

```ts
await ctx.remote.draftSessions.list({ workspaceId });

await ctx.draftSessionLifecycle.create({
  workspaceId,
  text: "",
});

await ctx.draftSessionLifecycle.ensureShell(draft);

await ctx.draftComposerBridge.open(draft);
await ctx.draftComposerBridge.flush();

await ctx.draftShortcutController.create(workspaceId);

await ctx.remote.draftSessions.update({
  id,
  expectedRevision: 4,
  text: "Add OTEL export",
});

await ctx.remote.draftSessions.rebind({
  id,
  expectedRevision: 5,
  sessionId: replacementSessionId,
});
```

The lifecycle service owns blank Session creation and recovery. The lower-level Remote methods remain available for storage operations; all mutations return the next `revision`, and a stale `expectedRevision` is rejected instead of silently overwriting another browser's edit.

## Design boundaries

- Draft text is authoritative in `DraftStore`; a blank Session is only an execution shell.
- Creating a draft must never make a model request.
- The first accepted prompt, not the Send button click, is the conversion boundary.
- Ordinary DSH Sessions remain owned entirely by DSH.
- Attachments are out of scope for v1; text and textual `@file` references come first.
- The upstream workspace browser currently has no public row-extension seam, so exact sidebar integration requires a small, version-tracked replacement package.

See [SPEC.md](SPEC.md) for acceptance criteria and [docs/architecture.md](docs/architecture.md) for the lifecycle.

## Contributing

Issues and focused pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and run `pnpm check` before submitting a change.

## License

[MIT](LICENSE)
