# Client Refactor, Localization, Reporting, and Bundle Budget Design

## Goal

Split the draft sidebar into focused modules, move browser-visible copy into the DeepSeek Harness locale runtime, replace direct browser console reporting with one Cordis-backed reporter, and enforce a production client-bundle budget without Zod.

## Current State

- `src/client/draft-sidebar-view.ts` contains 550 lines combining layout, row rendering, menu rendering, stateful hooks, drag-and-drop behavior, and CSS.
- Browser-visible English copy is embedded in both the sidebar view and its workspace/sidebar integration.
- Four background error paths call `console.error` directly from client code.
- `lib/client.js` is currently 187,143 bytes. Its source map shows that Zod dominates the bundled module inputs because the browser mounts strict Remote descriptors from `src/remote.ts`.
- `@deepseek-ai/dsh-client-locale@0.1.1-rc.2` ships `zh` and `en` as selectable locales. Its registry accepts additional untyped locale dictionaries, but its settings schema and language selector cannot activate `ru` yet.

## Sidebar Module Boundaries

Keep `src/client/draft-sidebar-view.ts` as a compatibility facade so existing imports and public exports remain stable. Move the implementation under `src/client/draft-sidebar/`:

- `view.ts` composes the panel, rows, menu, error alert, and translated copy.
- `row.ts` renders one tree item and owns row-local interaction markup.
- `menu.ts` renders and portals the action/confirmation menu.
- `hooks.ts` owns roving focus, menu placement, asynchronous action state, and drag state.
- `styles.ts` exports the sidebar CSS string.
- `types.ts` owns shared component props and interaction types.

Pure ordering and drop-target logic remains exported through the compatibility facade. The split must preserve keyboard navigation, inline rename, portal placement, drag-and-drop constraints, selection semantics, and existing CSS class names.

## Localization

Create a plugin-owned `draft-sessions` namespace in `src/client/locale.ts` and augment the Harness `LocaleNamespaceMap` with its complete key union. The dictionaries cover visible labels, menu actions, status badges, confirmation copy, empty-title fallback, footer copy, native-tab copy, and ARIA text.

Register `zh` and `en` together through the typed `ctx.locale.register(namespace, { zh, en })` overload. Register `ru` separately through the supported untyped `ctx.locale.register(namespace, "ru", ru)` overload. On the stock runtime this dictionary is dormant and cannot be selected; it neither changes the selectable-locale list nor throws. On a Harness build that adds `ru` to its locale list, the dictionary is already present. When upstream types add `ru` to `LocaleId`, the typed registration will fail until `ru` is moved into the complete typed dictionary record, making the migration explicit.

Use `ctx.locale.bind(namespace)` for translation and subscribe to the locale snapshot so nested draft UI rerenders on language changes. Pass the bound translator into presentational sidebar components rather than coupling them to Cordis. Because the ecosystem native-tab registry captures its label as a string, remove and reinsert the draft tab after `locale/change` so its label updates too.

Only plugin-owned static copy is translated. Dynamic errors received from Remote or browser APIs retain their original diagnostic text; the localized UI provides the surrounding static labels and actions.

## Reporter

Create one `DraftReporter` per plugin activation in `src/client/reporter.ts`. It wraps the built-in named Cordis logger returned by `ctx.logger("dsh-draft-sessions")` and exposes a narrow typed error-event API.

Pass the same reporter instance to the sidebar source, lifecycle bridge, shortcut controller, and workspace contribution. Replace the existing direct console calls with stable event identifiers:

- `sidebar-refresh`
- `draft-open`
- `shortcut-create`
- `session-finalize`

The reporter preserves the original unknown cause as structured logger data. Client production code must contain no direct `console.*` calls after the migration. User-triggered failures that are already rendered in the sidebar continue to surface there; the reporter owns background diagnostics, not UI state.

## Runtime Schemas and Zod Removal

Replace Zod with small domain-specific strict parsers implementing the Typert `TypertSchema` capability: `parse(value: unknown): Output`. Shared primitives validate exact object keys, required and optional fields, nullable fields, non-empty strings, booleans, non-negative safe integers, positive safe integers, literal versions, draft states, and arrays.

Build the request, result, draft-session, and draft-file schemas from those primitives. Reuse the draft-file parser for durable storage loading and preserve the existing `DRAFT_STORAGE_INVALID` conversion and duplicate-ID check. Remote descriptors remain in strict mode and continue rejecting unknown fields on both requests and results.

Remove the `zod` dependency after all strict-schema and storage tests pass. Keep `@deepseek-ai/schemastery` because it defines the host plugin configuration schema and is not the source of the browser-bundle regression.

## Bundle Budget

Extend `scripts/verify-client-bundle.mjs` so package verification checks both composition and size:

- fail if `lib/client.js` or its source map contains a bundled Zod module;
- fail when the raw `lib/client.js` byte count exceeds an 80 KiB (81,920-byte) budget;
- print the measured byte count and configured budget on success.

The 80 KiB limit leaves maintenance headroom above the plugin's own current source while remaining less than half the present 187,143-byte bundle, so a schema library of Zod's current size cannot return unnoticed. Cover the verifier behavior with a focused script-level test or an extracted pure budget helper.

## Testing and Verification

Follow red-green-refactor for behavior changes:

- add schema tests that first fail for missing parsers and cover valid values, unknown keys, invalid optional/nullable fields, unsafe integers, invalid states, corrupt storage, and strict Remote results;
- add locale tests that first fail for namespace registration, English/Chinese/Russian completeness, interpolation, locale-driven rerendering, and dormant `ru` registration without an exception;
- add reporter tests that first fail until every background error reaches the single named logger with its event and cause;
- retain and adapt sidebar interaction tests so the file split is behavior-neutral;
- add bundle-verifier tests before introducing the size limit and Zod exclusion.

After each independently verifiable implementation step, run its focused tests and commit it with a concise Conventional Commit subject. Before handoff, run formatting, type checking, the full test suite, production build, package verification, and inspect the final client size and git status.

## Commit Boundaries

1. Documentation: this approved design and the implementation plan.
2. Sidebar module split with unchanged behavior.
3. Harness locale namespace and translated sidebar/integration copy.
4. Unified Cordis-backed reporter.
5. Domain strict schemas and Zod removal.
6. Enforced bundle-size budget and package verification.

Do not mix unrelated repository changes or the pre-existing untracked `dist/` directory into these commits.
