import { describe, expect, it } from "vitest";
import {
  planDraftReorder,
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
});
