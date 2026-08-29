# Client Refactor, Localization, Reporting, and Bundle Budget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the draft sidebar into focused modules, localize all browser copy with an advance-compatible Russian dictionary, centralize background error reporting, remove Zod, and enforce an 80 KiB client-bundle budget.

**Architecture:** Preserve `draft-sidebar-view.ts` as a public facade while implementation files live under `src/client/draft-sidebar/`. Register one Harness locale namespace and one Cordis-backed reporter at client activation, then replace Zod with strict domain parsers shared by Remote descriptors and durable storage.

**Tech Stack:** TypeScript 7, React 18, Cordis 4, DeepSeek Harness locale and Typert APIs, Vitest 4, Testing Library, tsdown, pnpm 11.

---

## File Map

- `src/client/draft-sidebar-view.ts`: compatibility exports only.
- `src/client/draft-sidebar/view.ts`: panel composition and shared view state.
- `src/client/draft-sidebar/row.ts`: one accessible draft tree item.
- `src/client/draft-sidebar/menu.ts`: portalled actions and delete confirmation.
- `src/client/draft-sidebar/hooks.ts`: focus, menu placement, async action, and drag hooks.
- `src/client/draft-sidebar/styles.ts`: sidebar CSS.
- `src/client/draft-sidebar/types.ts`: props, translator, menu, drag, and drop types.
- `src/client/locale.ts`: namespace declaration, dictionaries, registration, and React subscription hook.
- `src/client/reporter.ts`: one named Cordis logger adapter.
- `src/shared/schema.ts`: dependency-free strict parsers for storage and Typert.
- `src/remote.ts`: descriptors composed from the shared schemas.
- `src/host/store.ts`: durable-state parsing through the shared schema.
- `scripts/client-bundle-budget.mjs`: pure size and dependency checks.
- `scripts/verify-client-bundle.mjs`: built artifact verification entrypoint.

### Task 1: Split the draft sidebar without changing behavior

**Files:**

- Create: `tests/draft-sidebar-structure.test.ts`
- Create: `src/client/draft-sidebar/types.ts`
- Create: `src/client/draft-sidebar/styles.ts`
- Create: `src/client/draft-sidebar/hooks.ts`
- Create: `src/client/draft-sidebar/menu.ts`
- Create: `src/client/draft-sidebar/row.ts`
- Create: `src/client/draft-sidebar/view.ts`
- Modify: `src/client/draft-sidebar-view.ts`
- Test: `tests/draft-sidebar-view.test.ts`

- [ ] **Step 1: Write the failing structural test**

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("draft sidebar source boundaries", () => {
  it("keeps the public view module as a small compatibility facade", async () => {
    const facade = await readFile("src/client/draft-sidebar-view.ts", "utf8");
    expect(facade.split(/\r?\n/u).length).toBeLessThan(12);
    for (const module of ["hooks", "menu", "row", "styles", "types", "view"]) {
      await expect(
        readFile(`src/client/draft-sidebar/${module}.ts`, "utf8"),
      ).resolves.toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Verify the structural test fails for the monolith**

Run: `pnpm exec vitest run tests/draft-sidebar-structure.test.ts`

Expected: FAIL because the facade is 550 lines and the six focused modules do not exist.

- [ ] **Step 3: Extract types and pure behavior**

Define the shared contracts in `types.ts` and preserve their existing signatures:

```ts
import type { DraftSession } from "../../shared/types.js";

export interface DraftDropTarget {
  readonly workspaceId: string;
  readonly beforeDraftId?: string;
}

export interface DraftSidebarViewProps {
  readonly surface?: "inline" | "tab" | "popover";
  readonly drafts: readonly DraftSession[];
  readonly currentSessionId?: string;
  readonly workspaceNames?: Readonly<Record<string, string>>;
  readonly onCreate: () => Promise<void>;
  readonly onOpen: (draft: DraftSession) => void;
  readonly onRename: (draft: DraftSession, title: string) => Promise<void>;
  readonly onDuplicate: (draft: DraftSession) => Promise<void>;
  readonly onDelete: (draft: DraftSession) => Promise<void>;
  readonly onReorder: (
    workspaceId: string,
    draftId: string,
    beforeDraftId?: string,
  ) => Promise<void>;
}

export type DropMarker = {
  readonly id: string;
  readonly half: "before" | "after";
};
```

Move the current `ordered` and `resolveDraftDropTarget` implementations into `view.ts` without changing their sort or compatibility rules.

- [ ] **Step 4: Extract styles, hooks, menu, and row**

Move the current `CSS` string unchanged to `styles.ts`. Implement hooks with explicit return contracts:

```ts
export function useRovingDraftFocus(rows: readonly DraftSession[]) {
  // Own activeId, row refs, stale-active recovery, and focusAt.
}

export function useDraftMenuPosition(menuId: string | undefined) {
  // Own action refs, menu ref, viewport placement, resize, and capture-scroll.
}

export function useDraftActions() {
  // Own editing, confirming, busy, creating, rename text, and visible error.
}

export function useDraftDrag(rows: readonly DraftSession[]) {
  // Own draggingId, drop marker, dragOver validation, and reset.
}
```

`menu.ts` must render the existing `role="menu"`, confirmation prompt, cancel/delete buttons, and `createPortal(..., document.body)`. `row.ts` must retain the current treeitem attributes, keyboard bindings, inline rename input, native drag handlers, workspace label, status badge, and action trigger.

- [ ] **Step 5: Compose the extracted modules and reduce the facade**

Use this complete facade:

```ts
export {
  DraftSidebarView,
  resolveDraftDropTarget,
} from "./draft-sidebar/view.js";
export type {
  DraftDropTarget,
  DraftSidebarViewProps,
} from "./draft-sidebar/types.js";
```

- [ ] **Step 6: Verify structure and all sidebar interactions**

Run: `pnpm exec vitest run tests/draft-sidebar-structure.test.ts tests/draft-sidebar-view.test.ts tests/sidebar-integration-view.test.ts`

Expected: PASS with 0 failures; the structure test sees all modules and every existing interaction remains green.

- [ ] **Step 7: Commit the behavior-neutral split**

```powershell
git add src/client/draft-sidebar-view.ts src/client/draft-sidebar tests/draft-sidebar-structure.test.ts
git commit -m "refactor: split draft sidebar view modules"
```

### Task 2: Register and consume the Harness locale namespace

**Files:**

- Create: `src/client/locale.ts`
- Create: `tests/locale.test.ts`
- Modify: `src/client/draft-sidebar/types.ts`
- Modify: `src/client/draft-sidebar/view.ts`
- Modify: `src/client/draft-sidebar/row.ts`
- Modify: `src/client/draft-sidebar/menu.ts`
- Modify: `src/client/workspace-contribution.ts`
- Modify: `src/client/index.ts`
- Modify: `tests/draft-sidebar-view.test.ts`
- Modify: `tests/sidebar-integration-view.test.ts`
- Modify: `tests/workspace-contribution.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Add the direct type dependency needed for namespace augmentation**

Add these exact entries to `package.json`, then run `pnpm install`:

```json
{
  "peerDependencies": {
    "@deepseek-ai/dsh-client-ui-slots": ">=0.1.1-rc.2 <0.2.0"
  },
  "devDependencies": {
    "@deepseek-ai/dsh-client-ui-slots": "0.1.1-rc.2"
  }
}
```

Expected: `package.json` contains the package in `peerDependencies` and `devDependencies`, and the lockfile resolves `0.1.1-rc.2`.

- [ ] **Step 2: Write failing locale registration and Russian rendering tests**

```ts
// @vitest-environment jsdom
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  DRAFT_LOCALE_NAMESPACE,
  dictionaries,
  registerDraftLocale,
} from "../src/client/locale.js";
import { DraftSidebarView } from "../src/client/draft-sidebar-view.js";

const viewProps = {
  drafts: [],
  onCreate: vi.fn(async () => undefined),
  onOpen: vi.fn(),
  onRename: vi.fn(async () => undefined),
  onDuplicate: vi.fn(async () => undefined),
  onDelete: vi.fn(async () => undefined),
  onReorder: vi.fn(async () => undefined),
};

describe("draft locale", () => {
  it("registers typed zh/en and a dormant ru dictionary", () => {
    const register = vi.fn(() => () => undefined);
    expect(() =>
      registerDraftLocale({ locale: { register } } as never),
    ).not.toThrow();
    expect(register).toHaveBeenNthCalledWith(1, DRAFT_LOCALE_NAMESPACE, {
      zh: dictionaries.zh,
      en: dictionaries.en,
    });
    expect(register).toHaveBeenNthCalledWith(
      2,
      DRAFT_LOCALE_NAMESPACE,
      "ru",
      dictionaries.ru,
    );
  });

  it("renders Russian copy through the translator prop", () => {
    const t = (
      key: keyof typeof dictionaries.ru,
      params?: Record<string, unknown>,
    ) =>
      dictionaries.ru[key].replace(/\{(\w+)\}/gu, (_, name) =>
        String(params?.[name]),
      );
    render(createElement(DraftSidebarView, { ...viewProps, t: t as never }));
    expect(screen.getByRole("button", { name: "Новый черновик" })).toBeTruthy();
    expect(
      screen.getByRole("tree", { name: "Сеансы черновиков" }),
    ).toBeTruthy();
  });
});
```

- [ ] **Step 3: Verify the locale tests fail**

Run: `pnpm exec vitest run tests/locale.test.ts tests/draft-sidebar-view.test.ts`

Expected: FAIL because `src/client/locale.ts` and the translator prop do not exist.

- [ ] **Step 4: Implement the namespace, dictionaries, registration, and hook**

Declare keys under `@deepseek-ai/dsh-client-ui-slots` and export these public values:

```ts
export const DRAFT_LOCALE_NAMESPACE = "draft-sessions";

export const dictionaries = {
  zh: zhDictionary,
  en: enDictionary,
  ru: ruDictionary,
} as const;

export type DraftTranslate = TranslateNS<typeof DRAFT_LOCALE_NAMESPACE>;

export function registerDraftLocale(ctx: Context): () => void {
  const disposeTyped = ctx.locale.register(DRAFT_LOCALE_NAMESPACE, {
    zh: dictionaries.zh,
    en: dictionaries.en,
  });
  const disposeRussian = ctx.locale.register(
    DRAFT_LOCALE_NAMESPACE,
    "ru",
    dictionaries.ru,
  );
  return () => {
    disposeRussian();
    disposeTyped();
  };
}

export function useDraftTranslate(ctx: Context): DraftTranslate {
  useSyncExternalStore(
    ctx.locale.subscribe.bind(ctx.locale),
    ctx.locale.getSnapshot.bind(ctx.locale),
    ctx.locale.getSnapshot.bind(ctx.locale),
  );
  return ctx.locale.bind(DRAFT_LOCALE_NAMESPACE);
}
```

Use the exact key set `section.label`, `section.aria`, `draft.untitled`, `draft.row`, `draft.title.input`, `draft.status.default`, `draft.status.error`, `action.new`, `action.actions`, `action.rename`, `action.duplicate`, `action.delete`, `action.delete.ellipsis`, `delete.confirm`, `action.cancel`, and `footer.count` in all three dictionaries.

- [ ] **Step 5: Replace every embedded UI string**

Make `t: DraftTranslate` required in `DraftSidebarViewProps`. Pass it to `DraftSidebarRow` and `DraftSidebarMenu`, and use interpolation for row/action/footer ARIA labels. In `workspace-contribution.ts`, call `useDraftTranslate(ctx)` inside rendered components; use `ctx.locale.bind(DRAFT_LOCALE_NAMESPACE)` for the captured native-tab label and force tab remove/reinsert on `locale/change`.

Register the dictionaries inside the injected client scope:

```ts
remoteCtx.effect(
  () => registerDraftLocale(remoteCtx),
  "draft sessions: locale dictionaries",
);
```

- [ ] **Step 6: Verify locale behavior and all affected UI tests**

Run: `pnpm exec vitest run tests/locale.test.ts tests/draft-sidebar-view.test.ts tests/sidebar-integration-view.test.ts tests/workspace-contribution.test.ts tests/client-index.test.ts`

Expected: PASS with English defaults in existing assertions, Russian assertions passing through `t`, and a native tab that refreshes its translated label.

- [ ] **Step 7: Commit localization**

```powershell
git add package.json pnpm-lock.yaml src/client/locale.ts src/client/index.ts src/client/workspace-contribution.ts src/client/draft-sidebar tests/locale.test.ts tests/draft-sidebar-view.test.ts tests/sidebar-integration-view.test.ts tests/workspace-contribution.test.ts tests/client-index.test.ts
git commit -m "feat: localize draft session browser UI"
```

### Task 3: Route background failures through one reporter

**Files:**

- Create: `src/client/reporter.ts`
- Create: `tests/reporter.test.ts`
- Modify: `src/client/index.ts`
- Modify: `src/client/sidebar.ts`
- Modify: `src/client/lifecycle.ts`
- Modify: `src/client/shortcut.ts`
- Modify: `src/client/workspace-contribution.ts`
- Modify: `tests/client-index.test.ts`
- Modify: `tests/sidebar.test.ts`
- Modify: `tests/lifecycle.test.ts`
- Modify: `tests/shortcut.test.ts`
- Modify: `tests/workspace-contribution.test.ts`

- [ ] **Step 1: Write the failing reporter unit test and console guard**

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { DraftReporter } from "../src/client/reporter.js";

describe("DraftReporter", () => {
  it("uses one named Cordis logger and preserves the cause", () => {
    const error = vi.fn();
    const logger = vi.fn(() => ({ error }));
    const cause = new Error("offline");
    const reporter = new DraftReporter({ logger } as never);
    reporter.error("draft-open", cause);
    expect(logger).toHaveBeenCalledWith("dsh-draft-sessions");
    expect(error).toHaveBeenCalledWith("[%s] %o", "draft-open", cause);
  });

  it("keeps direct console calls out of client production code", async () => {
    const files = [
      "sidebar.ts",
      "lifecycle.ts",
      "shortcut.ts",
      "workspace-contribution.ts",
    ];
    for (const file of files) {
      expect(await readFile(`src/client/${file}`, "utf8")).not.toMatch(
        /console\./u,
      );
    }
  });
});
```

- [ ] **Step 2: Verify reporter tests fail**

Run: `pnpm exec vitest run tests/reporter.test.ts`

Expected: FAIL because `DraftReporter` is missing and four client files still call `console.error`.

- [ ] **Step 3: Implement the reporter and inject one instance**

```ts
import type { Context, Logger } from "@deepseek-ai/cordis";

export type DraftReportEvent =
  "sidebar-refresh" | "draft-open" | "shortcut-create" | "session-finalize";

export class DraftReporter {
  private readonly logger: Logger;

  constructor(ctx: Pick<Context, "logger">) {
    this.logger = ctx.logger("dsh-draft-sessions");
  }

  error(event: DraftReportEvent, cause: unknown): void {
    this.logger.error("[%s] %o", event, cause);
  }
}
```

Construct one reporter in `apply`, pass it through each constructor option and `activateWorkspaceContribution`, and store it in readonly fields. Replace each direct console call with the matching event identifier.

- [ ] **Step 4: Prove the same instance reaches every background path**

Extend `tests/client-index.test.ts` so the mocked sidebar, lifecycle, shortcut, and workspace contribution calls all contain the same `reporter` object. Extend each component test to reject its background action and assert the corresponding `reporter.error(event, cause)` call.

- [ ] **Step 5: Verify reporting tests and client behavior**

Run: `pnpm exec vitest run tests/reporter.test.ts tests/client-index.test.ts tests/sidebar.test.ts tests/lifecycle.test.ts tests/shortcut.test.ts tests/workspace-contribution.test.ts`

Expected: PASS with all four event identifiers observed and no `console.*` in `src/client`.

- [ ] **Step 6: Commit reporting**

```powershell
git add src/client/reporter.ts src/client/index.ts src/client/sidebar.ts src/client/lifecycle.ts src/client/shortcut.ts src/client/workspace-contribution.ts tests/reporter.test.ts tests/client-index.test.ts tests/sidebar.test.ts tests/lifecycle.test.ts tests/shortcut.test.ts tests/workspace-contribution.test.ts
git commit -m "refactor: centralize draft client error reporting"
```

### Task 4: Replace Zod with strict domain schemas

**Files:**

- Create: `src/shared/schema.ts`
- Create: `tests/schema.test.ts`
- Modify: `src/remote.ts`
- Modify: `src/host/store.ts`
- Delete: `src/host/schema.ts`
- Modify: `tests/remote.test.ts`
- Modify: `tests/store.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Write failing domain-schema tests**

```ts
import { describe, expect, it } from "vitest";
import {
  createDraftRequestSchema,
  draftFileSchema,
  draftSessionSchema,
  updateDraftRequestSchema,
} from "../src/shared/schema.js";

const validDraft = {
  version: 1,
  id: "draft-a",
  sessionId: null,
  workspaceId: "workspace-a",
  text: "unsent",
  createdAt: 1,
  updatedAt: 1,
  order: 0,
  state: "draft",
  revision: 1,
} as const;
const validDraftFile = { version: 1, drafts: [validDraft] } as const;

describe("strict draft schemas", () => {
  it("accepts a complete valid draft file", () => {
    expect(draftFileSchema.parse(validDraftFile)).toEqual(validDraftFile);
  });

  it.each([
    { workspaceId: "w", unexpected: true },
    { workspaceId: "" },
    { workspaceId: "w", order: -1 },
    { workspaceId: "w", order: Number.MAX_SAFE_INTEGER + 1 },
  ])("rejects an invalid create request: %o", (value) => {
    expect(() => createDraftRequestSchema.parse(value)).toThrow();
  });

  it("rejects invalid states, nullable mistakes, and unknown draft fields", () => {
    expect(() =>
      draftSessionSchema.parse({ ...validDraft, state: "lost" }),
    ).toThrow();
    expect(() =>
      updateDraftRequestSchema.parse({
        id: "a",
        expectedRevision: 1,
        title: 4,
      }),
    ).toThrow();
    expect(() =>
      draftSessionSchema.parse({ ...validDraft, extra: true }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Verify schema tests fail**

Run: `pnpm exec vitest run tests/schema.test.ts tests/remote.test.ts tests/store.test.ts`

Expected: FAIL because `src/shared/schema.ts` does not exist.

- [ ] **Step 3: Implement strict parsing primitives**

Use a small `schema(parse)` factory returning `TypertSchema<T>`, plus these exact checks:

```ts
function object(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new SchemaError(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown !== undefined)
    throw new SchemaError(`${path}.${unknown} is unknown`);
}

function nonBlank(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new SchemaError(`${path} must be a non-empty string`);
  }
  return value;
}

function integer(value: unknown, minimum: number, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new SchemaError(`${path} must be a safe integer >= ${minimum}`);
  }
  return value as number;
}
```

Add boolean, literal, optional, nullable, array, and draft-state checks, then expose strict schemas for the draft session/file, all five requests, and all three result shapes used by Remote.

- [ ] **Step 4: Switch Remote and storage to the shared schemas**

Type `descriptor` parameters as `TypertSchema`, import every schema from `shared/schema.ts`, and keep every codec at `mode: "strict"`. In `DraftStore.loaded`, remove `ZodError`; pass `SchemaError.message` through the existing `DRAFT_STORAGE_INVALID` wrapper while preserving duplicate-ID detection.

- [ ] **Step 5: Remove Zod and verify strict boundaries**

Run:

```powershell
pnpm remove zod
pnpm exec vitest run tests/schema.test.ts tests/remote.test.ts tests/store.test.ts tests/gateway.test.ts tests/client-index.test.ts
pnpm run typecheck
```

Expected: all focused tests and type checking PASS; `rg -n "zod" src package.json` returns no matches. The lockfile may retain transitive Zod for the development-only Typert registry, but the plugin no longer declares or imports it.

- [ ] **Step 6: Commit schema replacement**

```powershell
git add package.json pnpm-lock.yaml src/shared/schema.ts src/remote.ts src/host/store.ts tests/schema.test.ts tests/remote.test.ts tests/store.test.ts
git rm src/host/schema.ts
git commit -m "refactor: replace Zod with strict draft schemas"
```

### Task 5: Enforce the client-bundle budget

**Files:**

- Create: `scripts/client-bundle-budget.mjs`
- Create: `scripts/client-bundle-budget.d.mts`
- Create: `tests/client-bundle-budget.test.ts`
- Modify: `scripts/verify-client-bundle.mjs`

- [ ] **Step 1: Write failing budget tests**

```ts
import { describe, expect, it } from "vitest";
import {
  CLIENT_BUNDLE_BUDGET,
  verifyClientBundleBudget,
} from "../scripts/client-bundle-budget.mjs";

describe("client bundle budget", () => {
  it("accepts a dependency-free bundle within 80 KiB", () => {
    expect(
      verifyClientBundleBudget(
        "x".repeat(CLIENT_BUNDLE_BUDGET),
        '{"sources":[]}',
      ),
    ).toEqual({ bytes: CLIENT_BUNDLE_BUDGET, budget: CLIENT_BUNDLE_BUDGET });
  });

  it("rejects an oversized bundle", () => {
    expect(() =>
      verifyClientBundleBudget(
        "x".repeat(CLIENT_BUNDLE_BUDGET + 1),
        '{"sources":[]}',
      ),
    ).toThrow(/exceeds.*81920/u);
  });

  it("rejects bundled Zod even below the size limit", () => {
    expect(() =>
      verifyClientBundleBudget(
        "small",
        '{"sources":["../node_modules/zod/v4/core/schemas.js"]}',
      ),
    ).toThrow(/Zod/u);
  });
});
```

- [ ] **Step 2: Verify budget tests fail**

Run: `pnpm exec vitest run tests/client-bundle-budget.test.ts`

Expected: FAIL because the budget helper does not exist.

- [ ] **Step 3: Implement the pure budget helper**

```js
export const CLIENT_BUNDLE_BUDGET = 80 * 1024;

export function verifyClientBundleBudget(client, sourceMap) {
  const bytes = Buffer.byteLength(client);
  if (/node_modules[\\/]zod[\\/]|zod\/v4/u.test(`${client}\n${sourceMap}`)) {
    throw new Error("client bundle must not contain Zod");
  }
  if (bytes > CLIENT_BUNDLE_BUDGET) {
    throw new Error(
      `client bundle ${bytes} bytes exceeds ${CLIENT_BUNDLE_BUDGET}-byte budget`,
    );
  }
  return { bytes, budget: CLIENT_BUNDLE_BUDGET };
}
```

Add a matching `.d.mts` declaration so TypeScript tests receive exact parameter and result types.

- [ ] **Step 4: Integrate the budget into package verification**

Read both `lib/client.js` and `lib/client.js.map` in `verify-client-bundle.mjs`, call `verifyClientBundleBudget`, retain every existing composition assertion, and print `client bundle: <bytes>/<budget> bytes` on success.

- [ ] **Step 5: Build and verify the real artifact**

Run:

```powershell
pnpm exec vitest run tests/client-bundle-budget.test.ts
pnpm run build
pnpm run test:package
(Get-Item lib/client.js).Length
```

Expected: tests and package verification PASS; the printed client size is at most 81,920 bytes and the source map contains no Zod module.

- [ ] **Step 6: Commit the budget gate**

```powershell
git add scripts/client-bundle-budget.mjs scripts/client-bundle-budget.d.mts scripts/verify-client-bundle.mjs tests/client-bundle-budget.test.ts
git commit -m "build: enforce client bundle size budget"
```

### Task 6: Full verification and handoff

**Files:**

- Verify: all tracked implementation files
- Preserve: untracked `dist/`

- [ ] **Step 1: Run the complete quality gate**

Run: `pnpm check`

Expected: formatting, type checking, all tests, build, package verification, and compatibility checks PASS with 0 failures.

- [ ] **Step 2: Inspect requirements and repository state**

Run:

```powershell
rg -n "console\." src/client
rg -n "zod" src package.json lib/client.js.map
Get-ChildItem src/client/draft-sidebar -File | Select-Object Name,Length
Get-Item lib/client.js | Select-Object Length
git status --short --branch
git log -7 --oneline
```

Expected: both searches return no matches; sidebar modules are focused files; `lib/client.js` is at most 81,920 bytes; only the pre-existing untracked `dist/` remains; all implementation steps are separate Conventional Commits.

- [ ] **Step 3: Request code review and resolve findings**

Review the commit range from the design commit parent through `HEAD` against this plan. Fix every Critical or Important finding with a failing regression test first, rerun `pnpm check`, and commit each independently verifiable correction.
