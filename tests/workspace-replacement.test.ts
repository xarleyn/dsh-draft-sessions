import { beforeEach, describe, expect, it, vi } from "vitest";

const upstream = vi.hoisted(() => ({ apply: vi.fn() }));

vi.mock("@deepseek-ai/dsh-client-ui-workspace/client", () => ({
  apply: upstream.apply,
}));

import { activateWorkspaceReplacement } from "../src/client/workspace-replacement.js";
import type { DraftSession } from "../src/shared/types.js";

function compatibleRegistration() {
  const component = () => null;
  return {
    component,
    options: {
      name: "sidebar.workspaces",
      children: {
        "sidebar.workspaces.directoryFlow": {
          kind: "single",
          scope: "root",
        },
      },
      store: {},
      locale: "workspace",
      inject: () => ({ hooks: { upstream: "source" }, open: vi.fn() }),
    },
  };
}

describe("workspace replacement activation", () => {
  beforeEach(() => {
    upstream.apply.mockReset();
  });

  it("adapts the pinned upstream registration and retains its hooks", async () => {
    const registration = compatibleRegistration();
    const register = vi.fn(() => () => undefined);
    upstream.apply.mockImplementation((ctx) => {
      ctx.slots.register(registration.options, registration.component);
    });
    const ctx = {
      slots: {
        entries: () => [],
        register,
      },
    } as never;
    const source = { getSnapshot: () => [], subscribe: vi.fn() } as never;

    expect(activateWorkspaceReplacement(ctx, source)).toBe("activated");
    expect(register).toHaveBeenCalledOnce();
    const [options, component] = register.mock.calls[0] as unknown as [
      { inject: () => Record<string, unknown> },
      unknown,
    ];
    expect(component).not.toBe(registration.component);
    expect(options.inject()).toMatchObject({
      hooks: { upstream: "source", drafts: source },
    });
    const open = vi.fn();
    const renameSession = vi.fn(async () => undefined);
    const archiveSession = vi.fn(async () => undefined);
    const insertSessionBefore = vi.fn(async () => undefined);
    const adapted = component as (props: Record<string, unknown>) => {
      props: Record<string, unknown>;
    };
    const element = adapted({
      useDrafts: (selector: (value: readonly unknown[]) => unknown) =>
        selector([]),
      useSessions: (selector: (value: { current: undefined }) => unknown) =>
        selector({ current: undefined }),
      useWorkspaces: (selector: (value: { items: never[] }) => unknown) =>
        selector({ items: [] }),
      wide: false,
      open,
      renameSession,
      forkSession: vi.fn(),
      archiveSession,
      insertSessionBefore,
    });
    const children = element.props.children as [
      null,
      { props: { children: { props: Record<string, unknown> } } },
    ];
    const upstreamProps = children[1].props.children.props;
    (upstreamProps.open as (id: string) => void)("session-normal");
    await (
      upstreamProps.renameSession as (
        id: string,
        title: string,
      ) => Promise<void>
    )("session-normal", "Normal");
    await (upstreamProps.archiveSession as (id: string) => Promise<void>)(
      "session-normal",
    );
    await (
      upstreamProps.insertSessionBefore as (
        workspaceId: string,
        id: string,
      ) => Promise<void>
    )("workspace-a", "session-normal");
    expect(open).toHaveBeenCalledWith("session-normal");
    expect(renameSession).toHaveBeenCalledWith("session-normal", "Normal");
    expect(archiveSession).toHaveBeenCalledWith("session-normal");
    expect(insertSessionBefore).toHaveBeenCalledWith(
      "workspace-a",
      "session-normal",
    );
  });

  it("leaves an already active upstream occupant untouched", () => {
    const ctx = {
      slots: { entries: () => [{}] },
    } as never;

    expect(activateWorkspaceReplacement(ctx, {} as never)).toBe(
      "upstream-active",
    );
    expect(upstream.apply).not.toHaveBeenCalled();
  });

  it("flushes and clears the active composer before deleting its draft", async () => {
    const registration = compatibleRegistration();
    const register = vi.fn(() => () => undefined);
    upstream.apply.mockImplementation((ctx) => {
      ctx.slots.register(registration.options, registration.component);
    });
    const events: string[] = [];
    const remove = vi.fn();
    const draft: DraftSession = {
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
    };
    const saved = { ...draft, text: "Autosaved", revision: 2 };
    const deleteDraft = vi.fn(async () => {
      events.push("delete");
      return { ok: true as const, value: undefined };
    });
    const ctx = {
      slots: { entries: () => [], register },
      draftComposerBridge: {
        close: vi.fn(async () => {
          events.push("close");
          return saved;
        }),
        open: vi.fn(),
      },
      remote: {
        draftSessions: {
          delete: deleteDraft,
        },
      },
      sessions: {
        clear: vi.fn(() => events.push("clear")),
      },
    } as never;
    const source = {
      getSnapshot: () => [draft],
      subscribe: vi.fn(),
      remove,
    } as never;

    activateWorkspaceReplacement(ctx, source);
    const [, registeredComponent] = register.mock.calls[0] as unknown as [
      unknown,
      unknown,
    ];
    const component = registeredComponent as (
      props: Record<string, unknown>,
    ) => { props: { children: [{ props: Record<string, unknown> }, unknown] } };
    const element = component({
      useDrafts: (selector: (value: readonly DraftSession[]) => unknown) =>
        selector([draft]),
      useSessions: (selector: (value: { current: string }) => unknown) =>
        selector({ current: "shell-a" }),
      useWorkspaces: (
        selector: (value: {
          items: readonly Record<string, unknown>[];
        }) => unknown,
      ) =>
        selector({
          items: [
            {
              workspaceId: "workspace-a",
              title: "Workspace A",
              sessionIds: ["shell-a"],
            },
          ],
        }),
      wide: true,
    });
    const panel = element.props.children[0];

    await (panel.props.onDelete as (value: DraftSession) => Promise<void>)(
      draft,
    );

    expect(events).toEqual(["close", "delete", "clear"]);
    expect(deleteDraft).toHaveBeenCalledWith({
      id: "draft-a",
      expectedRevision: 2,
    });
    expect(remove).toHaveBeenCalledWith("draft-a");
  });

  it("restores the active composer when draft deletion is rejected", async () => {
    const registration = compatibleRegistration();
    const register = vi.fn(() => () => undefined);
    upstream.apply.mockImplementation((ctx) => {
      ctx.slots.register(registration.options, registration.component);
    });
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
    const open = vi.fn(async () => draft);
    const clear = vi.fn();
    const remove = vi.fn();
    const ctx = {
      slots: { entries: () => [], register },
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
    } as never;
    const source = {
      getSnapshot: () => [draft],
      subscribe: vi.fn(),
      remove,
    } as never;

    activateWorkspaceReplacement(ctx, source);
    const [, registeredComponent] = register.mock.calls[0] as unknown as [
      unknown,
      unknown,
    ];
    const component = registeredComponent as (
      props: Record<string, unknown>,
    ) => { props: { children: [{ props: Record<string, unknown> }, unknown] } };
    const element = component({
      useDrafts: (selector: (value: readonly DraftSession[]) => unknown) =>
        selector([draft]),
      useSessions: (selector: (value: { current: string }) => unknown) =>
        selector({ current: "shell-a" }),
      useWorkspaces: (selector: (value: { items: never[] }) => unknown) =>
        selector({ items: [] }),
      wide: true,
    });

    await expect(
      (
        element.props.children[0].props.onDelete as (
          value: DraftSession,
        ) => Promise<void>
      )(draft),
    ).rejects.toThrow("stale revision");
    expect(open).toHaveBeenCalledWith(draft);
    expect(clear).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("falls back to an untouched registration on a contract mismatch", () => {
    const component = () => null;
    const register = vi.fn(() => () => undefined);
    upstream.apply.mockImplementation((ctx) => {
      ctx.slots.register(
        { name: "sidebar.workspaces", inject: () => ({}) },
        component,
      );
    });
    const ctx = {
      slots: { entries: () => [], register },
    } as never;

    expect(activateWorkspaceReplacement(ctx, {} as never)).toBe("activated");
    expect(register).toHaveBeenCalledWith(
      { name: "sidebar.workspaces", inject: expect.any(Function) },
      component,
    );
  });
});
