import type { Context } from "@deepseek-ai/cordis";
import type {
  SessionId,
  SessionListState,
  WorkspaceListState,
} from "@deepseek-ai/dsh-client-runtime/client";
import { createElement, type ComponentType, type FC } from "react";
import type { DraftSession } from "../shared/types.js";
import { DraftSidebarView } from "./draft-sidebar-view.js";
import { planDraftReorder, type DraftSidebarSource } from "./sidebar.js";

type SelectorHook<State> = <Selected>(
  selector: (state: State) => Selected,
) => Selected;

interface DraftContributionProps {
  readonly wide: boolean;
  readonly useDrafts: SelectorHook<readonly DraftSession[]>;
  readonly useSessions: SelectorHook<SessionListState>;
  readonly useWorkspaces: SelectorHook<WorkspaceListState>;
}

interface ComposableSlots {
  inject(name: string, callback: () => () => void): () => void;
  register(
    options: Record<string, unknown>,
    component: ComponentType<DraftContributionProps>,
  ): () => void;
  excludeSessionRows(
    name: string,
    source: {
      getSnapshot: () => ReadonlySet<SessionId>;
      subscribe: (listener: () => void) => () => void;
    },
  ): () => void;
}

/** Build the additive draft rows while leaving the workspace browser intact. */
export function createDraftWorkspaceContribution(
  ctx: Context,
  source: DraftSidebarSource,
): FC<DraftContributionProps> {
  return function DraftWorkspaceContribution({
    wide,
    useDrafts,
    useSessions,
    useWorkspaces,
  }) {
    const drafts = useDrafts((value) => value);
    const currentSessionId = useSessions((state) => state.current);
    const workspaceNames = Object.fromEntries(
      useWorkspaces((state) => state.items).map((workspace) => [
        String(workspace.workspaceId),
        workspace.title,
      ]),
    );
    if (!wide) return null;

    const rename = async (draft: DraftSession, title: string) => {
      const result = await ctx.remote.draftSessions.update({
        id: draft.id,
        expectedRevision: draft.revision,
        title,
      });
      if (!result.ok) throw new Error(result.error.message);
      source.accept(result.value);
    };
    const duplicate = async (draft: DraftSession) => {
      const created = await ctx.draftSessionLifecycle.create({
        workspaceId: draft.workspaceId,
        text: draft.text,
        ...(draft.title === undefined ? {} : { title: draft.title }),
      });
      source.accept(created);
      await ctx.draftComposerBridge.open(created);
    };
    const remove = async (draft: DraftSession) => {
      const isCurrent =
        draft.sessionId !== null && draft.sessionId === currentSessionId;
      const saved = isCurrent
        ? ((await ctx.draftComposerBridge.close()) ?? draft)
        : draft;
      let result: Awaited<ReturnType<typeof ctx.remote.draftSessions.delete>>;
      try {
        result = await ctx.remote.draftSessions.delete({
          id: saved.id,
          expectedRevision: saved.revision,
        });
      } catch (cause) {
        if (isCurrent) {
          await ctx.draftComposerBridge.open(saved).catch(() => undefined);
        }
        throw cause;
      }
      if (!result.ok) {
        if (isCurrent) {
          await ctx.draftComposerBridge.open(saved).catch(() => undefined);
        }
        throw new Error(result.error.message);
      }
      source.remove(draft.id);
      if (isCurrent) ctx.sessions.clear();
    };
    const reorder = async (
      workspaceId: string,
      draftId: string,
      beforeDraftId?: string,
    ) => {
      const workspaceDrafts = drafts.filter(
        (draft) => draft.workspaceId === workspaceId,
      );
      for (const update of planDraftReorder(
        workspaceDrafts,
        draftId,
        beforeDraftId,
      )) {
        const result = await ctx.remote.draftSessions.update(update);
        if (!result.ok) throw new Error(result.error.message);
        source.accept(result.value);
      }
    };

    return createElement(DraftSidebarView, {
      drafts,
      currentSessionId,
      workspaceNames,
      onCreate: async () => {
        await ctx.draftShortcutController.create();
      },
      onOpen: (draft) => {
        void ctx.draftComposerBridge.open(draft).catch((error: unknown) => {
          console.error("draft open failed", error);
        });
      },
      onRename: rename,
      onDuplicate: duplicate,
      onDelete: remove,
      onReorder: reorder,
    });
  };
}

/**
 * Register draft rows into the additive seat and hide only their execution
 * shells from the independent workspace-browser occupant.
 */
export function activateWorkspaceContribution(
  ctx: Context,
  source: DraftSidebarSource,
): "activated" {
  const slots = ctx.slots as unknown as ComposableSlots;
  if (typeof slots.excludeSessionRows !== "function") {
    throw new Error(
      "dsh-draft-sessions requires a Harness build with composable sidebar session rows",
    );
  }
  const excluded = {
    getSnapshot: source.getShellSnapshot,
    subscribe: source.subscribe,
  };
  slots.inject("sidebar.workspaces", () =>
    slots.excludeSessionRows("sidebar.workspaces", excluded),
  );
  slots.inject("sidebar.workspaces.before", () =>
    slots.register(
      {
        name: "sidebar.workspaces.before",
        id: "dsh-draft-sessions",
        inject: () => ({ hooks: { drafts: source } }),
      },
      createDraftWorkspaceContribution(ctx, source),
    ),
  );
  return "activated";
}
