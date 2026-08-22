import { describe, expect, it } from "vitest";
import {
  planDraftReorder,
  projectDraftSessions,
  projectDraftWorkspaces,
  projectOrdinarySessions,
  projectOrdinaryWorkspaces,
  projectWorkspaceSidebar,
} from "../src/client/sidebar.js";
import type { DraftSession } from "../src/shared/types.js";

function draft(
  id: string,
  order: number,
  overrides: Partial<DraftSession> = {},
): DraftSession {
  return {
    version: 1,
    id,
    sessionId: `shell-${id}`,
    workspaceId: "workspace-a",
    text: `Task ${id}`,
    createdAt: 1_000,
    updatedAt: 1_000,
    order,
    state: "ready",
    revision: order + 1,
    ...overrides,
  };
}

describe("draft sidebar projection", () => {
  it("places ordered muted drafts before ordinary Sessions", () => {
    const nodes = projectWorkspaceSidebar({
      workspaceId: "workspace-a",
      drafts: [
        draft("b", 1),
        draft("a", 0),
        draft("pinned", 9, { pinned: true, title: "Pinned" }),
      ],
      sessionIds: ["session-normal", "shell-a", "shell-b", "shell-pinned"],
      currentSessionId: "shell-a",
    });

    expect(nodes).toMatchObject([
      { kind: "draft", draftId: "pinned", title: "Pinned", muted: true },
      { kind: "draft", draftId: "a", selected: true },
      { kind: "draft", draftId: "b", selected: false },
      { kind: "session", sessionId: "session-normal" },
    ]);
  });

  it("keeps a shell-less draft visible and supplies an untitled label", () => {
    expect(
      projectWorkspaceSidebar({
        workspaceId: "workspace-a",
        drafts: [draft("a", 0, { sessionId: null, text: "" })],
        sessionIds: [],
        untitled: "New draft",
      }),
    ).toMatchObject([
      {
        kind: "draft",
        draftId: "a",
        sessionId: null,
        title: "New draft",
        state: "ready",
      },
    ]);
  });

  it("plans a stable append reorder with optimistic revisions", () => {
    expect(
      planDraftReorder([draft("a", 0), draft("b", 1), draft("c", 2)], "a"),
    ).toEqual([
      { id: "b", expectedRevision: 2, order: 0 },
      { id: "c", expectedRevision: 3, order: 1 },
      { id: "a", expectedRevision: 1, order: 2 },
    ]);
  });

  it("rejects unknown reorder identities and no-ops self insertion", () => {
    const drafts = [draft("a", 0), draft("b", 1)];
    expect(planDraftReorder(drafts, "a", "a")).toEqual([]);
    expect(() => planDraftReorder(drafts, "missing")).toThrow(
      'unknown draft "missing"',
    );
    expect(() => planDraftReorder(drafts, "a", "missing")).toThrow(
      'unknown before draft "missing"',
    );
  });

  it("projects backing shells as titled visible rows", () => {
    const ordinary = {
      id: "session-normal",
      displayTitle: "Normal",
      running: false,
      blank: false,
      updatedAt: 50,
    };
    const shell = {
      id: "shell-a",
      displayTitle: "New Session",
      running: false,
      blank: true,
      updatedAt: 50,
    };
    const state = {
      ids: ["session-normal", "shell-a"],
      byId: { "session-normal": ordinary, "shell-a": shell },
      current: "session-normal",
    } as never;

    const projected = projectDraftSessions(state, [
      draft("a", 0, { text: "Prepare release", updatedAt: 99 }),
    ]);

    expect(projected.byId["session-normal"]).toBe(ordinary);
    expect(projected.byId["shell-a"]).toMatchObject({
      blank: false,
      displayTitle: "Prepare release · Draft",
      updatedAt: 99,
    });
  });

  it("prepends draft shells to their Workspace account", () => {
    const state = {
      items: [
        {
          workspaceId: "workspace-a",
          sessionIds: ["session-normal", "shell-b", "shell-a"],
        },
      ],
    } as never;

    const projected = projectDraftWorkspaces(state, [
      draft("b", 1),
      draft("a", 0),
    ]);

    expect(projected.items[0]?.sessionIds).toEqual([
      "shell-a",
      "shell-b",
      "session-normal",
    ]);
  });

  it("hides backing shells only from the ordinary upstream projections", () => {
    const normal = { id: "session-normal" };
    const shell = { id: "shell-a" };
    const sessions = {
      ids: ["session-normal", "shell-a"],
      byId: { "session-normal": normal, "shell-a": shell },
      current: "shell-a",
    } as never;
    const workspaces = {
      items: [
        {
          workspaceId: "workspace-a",
          sessionIds: ["session-normal", "shell-a"],
        },
      ],
    } as never;

    const projectedSessions = projectOrdinarySessions(sessions, [
      draft("a", 0),
    ]);
    const projectedWorkspaces = projectOrdinaryWorkspaces(workspaces, [
      draft("a", 0),
    ]);

    expect(projectedSessions.ids).toEqual(["session-normal"]);
    expect(projectedSessions.byId).toEqual({ "session-normal": normal });
    expect(projectedSessions.current).toBeUndefined();
    expect(projectedWorkspaces.items[0]?.sessionIds).toEqual([
      "session-normal",
    ]);
  });
});
