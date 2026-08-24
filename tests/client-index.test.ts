import { beforeEach, describe, expect, it, vi } from "vitest";

const observed = vi.hoisted(() => ({
  sidebar: vi.fn(),
  lifecycle: vi.fn(),
  composer: vi.fn(),
  shortcut: vi.fn(),
  contribution: vi.fn(),
}));

vi.mock("../src/client/sidebar.js", () => ({
  DraftSidebarSource: class {
    constructor(...args: unknown[]) {
      observed.sidebar(...args);
    }
  },
}));

vi.mock("../src/client/lifecycle.js", () => ({
  envelopeSource: (api: unknown) => api,
  DraftSessionLifecycle: class {
    constructor(...args: unknown[]) {
      observed.lifecycle(...args);
    }
  },
}));

vi.mock("../src/client/composer.js", () => ({
  DraftComposerBridge: class {
    constructor(...args: unknown[]) {
      observed.composer(...args);
    }
  },
}));

vi.mock("../src/client/shortcut.js", () => ({
  DraftShortcutController: class {
    constructor(...args: unknown[]) {
      observed.shortcut(...args);
    }
  },
}));

vi.mock("../src/client/workspace-contribution.js", () => ({
  activateWorkspaceContribution: observed.contribution,
}));

import { apply } from "../src/client/index.js";

describe("client activation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses a context injected with the mounted Remote namespace", async () => {
    const drafts = {};
    const sessionsApi = {};
    const subscribeEnvelopes = vi.fn(() => () => undefined);
    const disposeLocale = vi.fn();
    const registerLocale = vi.fn((..._args: unknown[]) => disposeLocale);
    const readyCtx = {
      remote: { draftSessions: drafts },
      connection: { api: { sessions: sessionsApi, subscribeEnvelopes } },
      sessions: {},
      workspaces: {},
      conversation: {},
      logger: vi.fn(() => ({ error: vi.fn() })),
      locale: { register: registerLocale },
      effect: vi.fn((factory: () => () => void) => factory()),
    };
    const dispose = vi.fn(async () => undefined);
    const mount = vi.fn(async () => dispose);
    const inject = vi.fn(
      async (
        dependencies: string[],
        callback: (ctx: typeof readyCtx) => void,
      ) => {
        expect(dependencies).toEqual(["remote.draftSessions"]);
        callback(readyCtx);
      },
    );
    const remote = { $mount: mount } as Record<string, unknown>;
    Object.defineProperty(remote, "draftSessions", {
      get() {
        throw new Error(
          'cannot get property "remote.draftSessions" without inject',
        );
      },
    });

    await expect(apply({ remote, inject } as never)).resolves.toBe(dispose);
    expect(mount).toHaveBeenCalledOnce();
    expect(inject).toHaveBeenCalledOnce();
    expect(observed.sidebar).toHaveBeenCalledWith(
      readyCtx,
      drafts,
      expect.any(Object),
    );
    const reporter = observed.sidebar.mock.calls[0]![2];
    expect(observed.lifecycle).toHaveBeenCalledWith(readyCtx, {
      drafts,
      sessions: sessionsApi,
      envelopes: { sessions: sessionsApi, subscribeEnvelopes },
      sidebar: expect.anything(),
      reporter,
    });
    expect(observed.composer).toHaveBeenCalledWith(readyCtx, {
      lifecycle: expect.anything(),
      drafts,
      sessions: readyCtx.sessions,
      conversation: readyCtx.conversation,
      sidebar: expect.anything(),
    });
    expect(observed.shortcut).toHaveBeenCalledWith(readyCtx, {
      lifecycle: expect.anything(),
      composer: expect.anything(),
      sessions: readyCtx.sessions,
      workspaces: readyCtx.workspaces,
      reporter,
    });
    expect(observed.contribution).toHaveBeenCalledWith(
      readyCtx,
      expect.anything(),
      reporter,
    );
    expect(registerLocale).toHaveBeenNthCalledWith(
      1,
      "draft-sessions",
      expect.objectContaining({
        zh: expect.any(Object),
        en: expect.any(Object),
      }),
    );
    expect(registerLocale).toHaveBeenNthCalledWith(
      2,
      "draft-sessions",
      "ru",
      expect.any(Object),
    );
    const typedDictionaries = registerLocale.mock.calls[0]![1] as Record<
      "zh" | "en",
      Record<string, string>
    >;
    const russianDictionary = registerLocale.mock.calls[1]![2] as Record<
      string,
      string
    >;
    expect(Object.keys(typedDictionaries.zh)).toEqual(
      Object.keys(typedDictionaries.en),
    );
    expect(Object.keys(typedDictionaries.en)).toEqual(
      Object.keys(russianDictionary),
    );
  });
});
