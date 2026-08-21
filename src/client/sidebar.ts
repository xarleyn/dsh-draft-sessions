import { Service, type Context } from "@deepseek-ai/cordis";
import type {
  SessionId,
  SessionListState,
  WorkspaceListState,
} from "@deepseek-ai/dsh-client-runtime/client";
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

type DraftListRemote = {
  list(request: {
    workspaceId?: string;
  }): Promise<
    | { ok: true; value: DraftSession[] }
    | { ok: false; error: { message: string } }
  >;
};

/** Observable Host-backed draft list used by the workspace replacement. */
export class DraftSidebarSource extends Service {
  private readonly drafts: DraftListRemote;
  private snapshot: readonly DraftSession[] = [];
  private readonly listeners = new Set<() => void>();
  private generation = 0;

  constructor(ctx: Context, drafts?: DraftListRemote) {
    super(ctx, "draftSidebarSource");
    this.drafts = drafts ?? ctx.remote.draftSessions;
    const refresh = () => {
      void this.refresh().catch((error: unknown) => {
        console.error("draft sidebar refresh failed", error);
      });
    };
    ctx.effect(
      () => ctx.sessions.list.subscribe(refresh),
      "draft-sidebar.sessions",
    );
    ctx.effect(
      () => ctx.workspaces.list.subscribe(refresh),
      "draft-sidebar.workspaces",
    );
    refresh();
  }

  getSnapshot = (): readonly DraftSession[] => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async refresh(): Promise<readonly DraftSession[]> {
    const generation = ++this.generation;
    const result = await this.drafts.list({});
    if (!result.ok) throw new Error(result.error.message);
    if (generation === this.generation) this.publish(result.value);
    return this.snapshot;
  }

  accept(draft: DraftSession): void {
    const next = this.snapshot.filter((item) => item.id !== draft.id);
    next.push(draft);
    this.generation += 1;
    this.publish(next);
  }

  remove(draftId: string): void {
    this.generation += 1;
    this.publish(this.snapshot.filter((draft) => draft.id !== draftId));
  }

  private publish(next: readonly DraftSession[]): void {
    this.snapshot = [...next];
    for (const listener of this.listeners) listener();
  }
}

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

export function projectDraftSessions(
  state: SessionListState,
  drafts: readonly DraftSession[],
): SessionListState {
  const byId = { ...state.byId };
  let changed = false;
  for (const draft of drafts) {
    if (draft.sessionId === null) continue;
    const id = draft.sessionId as SessionId;
    const summary = byId[id];
    if (summary === undefined) continue;
    const title = displayDraftTitle(draft) || "Untitled draft";
    byId[id] = {
      ...summary,
      blank: false,
      displayTitle: `${title} · Draft`,
      updatedAt: draft.updatedAt,
    };
    changed = true;
  }
  return changed ? { ...state, byId } : state;
}

export function projectDraftWorkspaces(
  state: WorkspaceListState,
  drafts: readonly DraftSession[],
): WorkspaceListState {
  const shellIds = new Set(
    drafts.flatMap((draft) =>
      draft.sessionId === null ? [] : [draft.sessionId],
    ),
  );
  const items = state.items.map((workspace) => {
    const leading = orderedDrafts(
      drafts.filter((draft) => draft.workspaceId === workspace.workspaceId),
    )
      .filter(
        (draft): draft is DraftSession & { sessionId: string } =>
          draft.sessionId !== null,
      )
      .map((draft) => draft.sessionId as SessionId);
    return {
      ...workspace,
      sessionIds: [
        ...leading,
        ...workspace.sessionIds.filter((id: SessionId) => !shellIds.has(id)),
      ],
    };
  });
  return { ...state, items };
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
