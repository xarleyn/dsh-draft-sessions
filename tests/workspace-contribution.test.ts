import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  activateWorkspaceContribution,
  createDraftWorkspaceContribution,
} from "../src/client/workspace-contribution.js";
import type { DraftSession } from "../src/shared/types.js";
import type {
  SessionListState,
  WorkspaceListState,
} from "@deepseek-ai/dsh-client-runtime/client";

const draft = {
  version: 1,
  id: "draft-a",
  sessionId: "shell-a",
  workspaceId: "workspace-a",
  text: "Unsent",
  createdAt: 1,
  updatedAt: 1,
  order: 0,
  state: "ready",
  revision: 1,
} satisfies DraftSession;

function renderContribution(ctx: unknown, source: unknown) {
  const component = createDraftWorkspaceContribution(
    ctx as never,
    source as never,
  );
  return component({
    wide: true,
    useDrafts: <Selected>(
      selector: (value: readonly DraftSession[]) => Selected,
    ) => selector([draft]),
    useSessions: <Selected>(selector: (value: SessionListState) => Selected) =>
      selector({ current: "shell-a" } as never),
    useWorkspaces: <Selected>(
      selector: (value: WorkspaceListState) => Selected,
    ) =>
      selector({
        items: [
          {
            workspaceId: "workspace-a",
            title: "Workspace A",
            sessionIds: ["shell-a"],
          },
        ],
      } as never),
  }) as { props: Record<string, unknown> };
}

describe("workspace draft contribution", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("composes with an existing workspace occupant without touching it", () => {
    const occupant = { component: () => null };
    const register = vi.fn(() => () => undefined);
    const excludeSessionRows = vi.fn(() => () => undefined);
    const ctx = {
      slots: {
        entries: (_name?: string) => [occupant],
        inject: (_name: string, callback: () => () => void) => callback(),
        register,
        excludeSessionRows,
      },
    };
    const source = {
      getSnapshot: () => [],
      getShellSnapshot: () => new Set(["shell-a"]),
      subscribe: vi.fn(),
    } as never;

    expect(activateWorkspaceContribution(ctx as never, source)).toBe(
      "activated",
    );
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "sidebar.workspaces.before",
        id: "dsh-draft-sessions",
      }),
      expect.any(Function),
    );
    expect(excludeSessionRows).toHaveBeenCalledWith(
      "sidebar.workspaces",
      expect.objectContaining({ getSnapshot: expect.any(Function) }),
    );
    expect(ctx.slots.entries("sidebar.workspaces")).toEqual([occupant]);
  });

  it("fails loudly when the Harness composition seam is absent", () => {
    const ctx = { slots: {} } as never;
    expect(() => activateWorkspaceContribution(ctx, {} as never)).toThrow(
      /composable sidebar session rows/,
    );
  });

  it("flushes and clears the active composer before deleting its draft", async () => {
    const events: string[] = [];
    const saved = { ...draft, text: "Autosaved", revision: 2 };
    const remove = vi.fn();
    const deleteDraft = vi.fn(async () => {
      events.push("delete");
      return { ok: true as const, value: undefined };
    });
    const ctx = {
      draftComposerBridge: {
        close: vi.fn(async () => {
          events.push("close");
          return saved;
        }),
        open: vi.fn(),
      },
      remote: { draftSessions: { delete: deleteDraft } },
      sessions: { clear: vi.fn(() => events.push("clear")) },
    };
    const source = { remove, accept: vi.fn() };
    const element = renderContribution(ctx, source);

    await (element.props.onDelete as (value: DraftSession) => Promise<void>)(
      draft,
    );

    expect(events).toEqual(["close", "delete", "clear"]);
    expect(deleteDraft).toHaveBeenCalledWith({
      id: "draft-a",
      expectedRevision: 2,
    });
    expect(remove).toHaveBeenCalledWith("draft-a");
  });

  it("routes the visible new-draft action through flush-create-open semantics", async () => {
    const create = vi.fn(async () => draft);
    const ctx = {
      draftShortcutController: { create },
    };
    const element = renderContribution(ctx, { accept: vi.fn() });

    await (element.props.onCreate as () => Promise<void>)();

    expect(create).toHaveBeenCalledOnce();
  });

  it("restores the active composer when draft deletion is rejected", async () => {
    const open = vi.fn(async () => draft);
    const clear = vi.fn();
    const remove = vi.fn();
    const ctx = {
      draftComposerBridge: { close: vi.fn(async () => draft), open },
      remote: {
        draftSessions: {
          delete: vi.fn(async () => ({
            ok: false as const,
            error: { message: "stale revision" },
          })),
        },
      },
      sessions: { clear },
    };
    const element = renderContribution(ctx, { remove, accept: vi.fn() });

    await expect(
      (element.props.onDelete as (value: DraftSession) => Promise<void>)(draft),
    ).rejects.toThrow("stale revision");
    expect(open).toHaveBeenCalledWith(draft);
    expect(clear).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});
