import type { UpdateDraftRequest } from "../shared/types.js";
import { displayDraftTitle, type DraftSession } from "../shared/types.js";

export interface DraftSidebarNode {
  readonly kind: "draft";
  readonly key: `draft:${string}`;
  readonly draftId: string;
  readonly sessionId: string | null;
  readonly title: string;
  readonly muted: true;
  readonly selected: boolean;
  readonly state: DraftSession["state"];
  readonly lastError?: string;
}

export interface SessionSidebarNode {
  readonly kind: "session";
  readonly key: `session:${string}`;
  readonly sessionId: string;
}

export type SidebarNode = DraftSidebarNode | SessionSidebarNode;

export interface ProjectWorkspaceSidebarOptions {
  readonly workspaceId: string;
  readonly drafts: readonly DraftSession[];
  readonly sessionIds: readonly string[];
  readonly currentSessionId?: string;
  readonly untitled?: string;
}

function orderedDrafts(drafts: readonly DraftSession[]): DraftSession[] {
  return [...drafts].sort(
    (left, right) =>
      Number(right.pinned === true) - Number(left.pinned === true) ||
      left.order - right.order ||
      left.id.localeCompare(right.id),
  );
}

/** Draft-first Workspace rows without duplicate backing blank Sessions. */
export function projectWorkspaceSidebar({
  workspaceId,
  drafts,
  sessionIds,
  currentSessionId,
  untitled = "Untitled draft",
}: ProjectWorkspaceSidebarOptions): SidebarNode[] {
  const workspaceDrafts = drafts.filter(
    (draft) => draft.workspaceId === workspaceId,
  );
  const shells = new Set(
    workspaceDrafts.flatMap((draft) =>
      draft.sessionId === null ? [] : [draft.sessionId],
    ),
  );
  const draftNodes: DraftSidebarNode[] = orderedDrafts(workspaceDrafts).map(
    (draft) => {
      const title = displayDraftTitle(draft);
      return {
        kind: "draft",
        key: `draft:${draft.id}`,
        draftId: draft.id,
        sessionId: draft.sessionId,
        title: title === "" ? untitled : title,
        muted: true,
        selected:
          draft.sessionId !== null && draft.sessionId === currentSessionId,
        state: draft.state,
        ...(draft.lastError === undefined
          ? {}
          : { lastError: draft.lastError }),
      };
    },
  );
  const sessionNodes: SessionSidebarNode[] = sessionIds
    .filter((sessionId) => !shells.has(sessionId))
    .map((sessionId) => ({
      kind: "session",
      key: `session:${sessionId}`,
      sessionId,
    }));
  return [...draftNodes, ...sessionNodes];
}

/** Build a stable, zero-based optimistic reorder update set. */
export function planDraftReorder(
  drafts: readonly DraftSession[],
  draftId: string,
  beforeDraftId?: string,
): UpdateDraftRequest[] {
  const current = orderedDrafts(drafts);
  const source = current.find((draft) => draft.id === draftId);
  if (source === undefined) throw new Error(`unknown draft "${draftId}"`);
  if (beforeDraftId === draftId) return [];

  const withoutSource = current.filter((draft) => draft.id !== draftId);
  const targetIndex =
    beforeDraftId === undefined
      ? withoutSource.length
      : withoutSource.findIndex((draft) => draft.id === beforeDraftId);
  if (targetIndex < 0) {
    throw new Error(`unknown before draft "${beforeDraftId}"`);
  }
  withoutSource.splice(targetIndex, 0, source);
  return withoutSource.flatMap((draft, order) =>
    draft.order === order
      ? []
      : [
          {
            id: draft.id,
            expectedRevision: draft.revision,
            order,
          },
        ],
  );
}
