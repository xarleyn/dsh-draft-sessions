import { beforeEach, describe, expect, it, vi } from "vitest";

const upstream = vi.hoisted(() => ({ apply: vi.fn() }));

vi.mock("@deepseek-ai/dsh-client-ui-workspace/client", () => ({
  apply: upstream.apply,
}));

import { activateWorkspaceReplacement } from "../src/client/workspace-replacement.js";

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
      useSessions: vi.fn(),
      useWorkspaces: vi.fn(),
      open,
      renameSession,
      forkSession: vi.fn(),
      archiveSession,
      insertSessionBefore,
    });
    (element.props.open as (id: string) => void)("session-normal");
    await (
      element.props.renameSession as (
        id: string,
        title: string,
      ) => Promise<void>
    )("session-normal", "Normal");
    await (element.props.archiveSession as (id: string) => Promise<void>)(
      "session-normal",
    );
    await (
      element.props.insertSessionBefore as (
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
      undefined,
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
