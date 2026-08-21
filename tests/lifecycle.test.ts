import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Context } from "@deepseek-ai/cordis";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DraftSessionLifecycle,
  type DraftSessionLifecycleOptions,
} from "../src/client/lifecycle.js";
import { DraftStore } from "../src/host/store.js";

const temporaryDirectories: string[] = [];

async function store(): Promise<DraftStore> {
  const directory = await mkdtemp(join(tmpdir(), "dsh-draft-lifecycle-"));
  temporaryDirectories.push(directory);
  return new DraftStore({
    storagePath: join(directory, "drafts.json"),
    id: () => "draft-a",
    now: () => 1_000,
  });
}

function remote(drafts: DraftStore): DraftSessionLifecycleOptions["drafts"] {
  return {
    list: async (request) => ({ ok: true, value: await drafts.list(request) }),
    create: async (request) => ({
      ok: true,
      value: await drafts.create(request),
    }),
    update: async (request) => ({
      ok: true,
      value: await drafts.update(request),
    }),
    delete: async (request) => ({
      ok: true,
      value: { deleted: await drafts.delete(request) },
    }),
    rebind: async (request) => ({
      ok: true,
      value: await drafts.rebind(request),
    }),
  };
}

function sessions(
  overrides: Partial<DraftSessionLifecycleOptions["sessions"]> = {},
): DraftSessionLifecycleOptions["sessions"] {
  return {
    list: async () =>
      ({
        rpcId: "rpc-list",
        result: { ok: true, value: { items: [] } },
      }) as never,
    create: async () =>
      ({
        rpcId: "rpc-create",
        result: { ok: true, value: { sessionId: "session-new" } },
      }) as never,
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("DraftSessionLifecycle", () => {
  it("persists a Session id only after distinct Session creation succeeds", async () => {
    const drafts = await store();
    const create = vi.fn(async (request: { workspaceId?: unknown }) => {
      expect(request).toEqual({ workspaceId: "workspace-a" });
      expect(await drafts.list()).toMatchObject([
        { sessionId: null, state: "materializing", text: "unsent" },
      ]);
      return {
        rpcId: "rpc-create",
        result: { ok: true, value: { sessionId: "session-a" } },
      } as never;
    });
    const lifecycle = new DraftSessionLifecycle(new Context(), {
      drafts: remote(drafts),
      sessions: sessions({ create }),
    });

    const created = await lifecycle.create({
      workspaceId: "workspace-a",
      text: "unsent",
    });

    expect(create).toHaveBeenCalledOnce();
    expect(created).toMatchObject({
      sessionId: "session-a",
      state: "ready",
      text: "unsent",
      revision: 3,
    });
    expect(await drafts.list()).toEqual([created]);
  });

  it("keeps the durable draft when Session creation is rejected", async () => {
    const drafts = await store();
    const lifecycle = new DraftSessionLifecycle(new Context(), {
      drafts: remote(drafts),
      sessions: sessions({
        create: async () =>
          ({
            rpcId: "rpc-create",
            result: {
              ok: false,
              error: {
                code: "workspace-not-found",
                message: "workspace disappeared",
                details: { workspaceId: "workspace-a" },
              },
            },
          }) as never,
      }),
    });

    await expect(
      lifecycle.create({ workspaceId: "workspace-a", text: "keep me" }),
    ).rejects.toMatchObject({
      name: "DraftLifecycleError",
      stage: "session-create",
      code: "workspace-not-found",
      draft: {
        sessionId: null,
        state: "error",
        text: "keep me",
        lastError: "workspace disappeared",
      },
    });
    expect(await drafts.list()).toMatchObject([
      { sessionId: null, state: "error", text: "keep me" },
    ]);
  });

  it("detects a missing Session shell and rebinds a replacement", async () => {
    const drafts = await store();
    const stale = await drafts.create({
      workspaceId: "workspace-a",
      sessionId: "session-missing",
      text: "recover me",
    });
    const create = vi.fn(
      async () =>
        ({
          rpcId: "rpc-create",
          result: { ok: true, value: { sessionId: "session-replacement" } },
        }) as never,
    );
    const lifecycle = new DraftSessionLifecycle(new Context(), {
      drafts: remote(drafts),
      sessions: sessions({ create }),
    });

    const recovered = await lifecycle.ensureShell(stale);

    expect(create).toHaveBeenCalledOnce();
    expect(recovered).toMatchObject({
      sessionId: "session-replacement",
      state: "ready",
      text: "recover me",
      revision: 3,
    });
  });

  it("does not replace a Session shell that is still present", async () => {
    const drafts = await store();
    const current = await drafts.create({
      workspaceId: "workspace-a",
      sessionId: "session-current",
    });
    const create = vi.fn();
    const lifecycle = new DraftSessionLifecycle(new Context(), {
      drafts: remote(drafts),
      sessions: sessions({
        list: async () =>
          ({
            rpcId: "rpc-list",
            result: {
              ok: true,
              value: {
                items: [
                  {
                    sessionId: "session-current",
                    updatedAt: 1_000,
                    running: false,
                    blank: true,
                  },
                ],
              },
            },
          }) as never,
        create,
      }),
    });

    await expect(lifecycle.ensureShell(current)).resolves.toBe(current);
    expect(create).not.toHaveBeenCalled();
  });
});
