import type { Context } from "@deepseek-ai/cordis";
import type {
  SessionId,
  SessionListState,
  WorkspaceId,
  WorkspaceListState,
} from "@deepseek-ai/dsh-client-runtime/client";
import { createElement, type ComponentType } from "react";
// tsdown replaces this value edge with the pinned client factory body, so the
// browser artifact never asks the module table for the disabled workspace row.
import { apply as applyUpstreamWorkspace } from "@deepseek-ai/dsh-client-ui-workspace/client";
import type { DraftSession } from "../shared/types.js";
import { DraftSidebarView } from "./draft-sidebar-view.js";
import {
  planDraftReorder,
  projectOrdinarySessions,
  projectOrdinaryWorkspaces,
  type DraftSidebarSource,
} from "./sidebar.js";

type SelectorHook<State> = <Selected>(
  selector: (state: State) => Selected,
) => Selected;

interface WorkspaceBrowserProps {
  readonly wide: boolean;
  readonly useDrafts: SelectorHook<readonly DraftSession[]>;
  readonly useSessions: SelectorHook<SessionListState>;
  readonly useWorkspaces: SelectorHook<WorkspaceListState>;
  readonly open: (sessionId: SessionId) => void;
  readonly renameSession: (
    sessionId: SessionId,
    title: string,
  ) => Promise<void>;
  readonly forkSession: (sessionId: SessionId) => void;
  readonly archiveSession: (sessionId: SessionId) => Promise<void>;
  readonly insertSessionBefore: (
    workspaceId: WorkspaceId,
    sessionId: SessionId,
    beforeSessionId?: SessionId,
  ) => Promise<void>;
  readonly [key: string]: unknown;
}

interface StoredWorkspaceEntry {
  readonly component: unknown;
  readonly inject?: ((...args: never[]) => Record<string, unknown>) | undefined;
  readonly children?: Readonly<Record<string, unknown>> | undefined;
  readonly store?: unknown;
  readonly locale?: string;
  readonly options?: { priority?: number };
}

interface WorkspaceRegistration {
  readonly name: string;
  readonly inject?: ((...args: never[]) => Record<string, unknown>) | undefined;
  readonly children?: Readonly<Record<string, unknown>> | undefined;
  readonly store?: unknown;
  readonly locale?: string;
  readonly priority?: number;
  readonly [key: string]: unknown;
}

function isCompatibleEntry(entry: StoredWorkspaceEntry): boolean {
  return (
    typeof entry.component === "function" &&
    typeof entry.inject === "function" &&
    entry.store !== undefined &&
    entry.locale === "workspace" &&
    entry.children !== undefined &&
    Object.hasOwn(entry.children, "sidebar.workspaces.directoryFlow")
  );
}

function replacementComponent(
  ctx: Context,
  source: DraftSidebarSource,
  upstream: ComponentType<WorkspaceBrowserProps>,
): ComponentType<WorkspaceBrowserProps> {
  return function DraftWorkspaceBrowser(props) {
    const drafts = props.useDrafts((value) => value);
    const currentSessionId = props.useSessions((state) => state.current);
    const workspaces = props.useWorkspaces((state) => state.items);
    const useSessions: SelectorHook<SessionListState> = (selector) =>
      props.useSessions((state) =>
        selector(projectOrdinarySessions(state, drafts)),
      );
    const useWorkspaces: SelectorHook<WorkspaceListState> = (selector) =>
      props.useWorkspaces((state) =>
        selector(projectOrdinaryWorkspaces(state, drafts)),
      );
    const workspaceNames = Object.fromEntries(
      workspaces.map((workspace) => [
        String(workspace.workspaceId),
        workspace.title,
      ]),
    );
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
    return createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          height: "100%",
        },
      },
      props.wide
        ? createElement(DraftSidebarView, {
            drafts,
            currentSessionId,
            workspaceNames,
            onOpen: (draft) => {
              void ctx.draftComposerBridge
                .open(draft)
                .catch((error: unknown) => {
                  console.error("draft open failed", error);
                });
            },
            onRename: rename,
            onDuplicate: duplicate,
            onDelete: remove,
            onReorder: reorder,
          })
        : null,
      createElement(
        "div",
        { style: { display: "flex", flex: 1, minHeight: 0 } },
        createElement(upstream, {
          ...props,
          useSessions,
          useWorkspaces,
        }),
      ),
    );
  };
}

/** Mount the pinned upstream browser through a guarded draft-aware adapter. */
export function activateWorkspaceReplacement(
  ctx: Context,
  source: DraftSidebarSource,
): "activated" | "upstream-active" {
  if (ctx.slots.entries("sidebar.workspaces").length > 0) {
    console.warn(
      "draft workspace replacement skipped because an upstream occupant is already active",
    );
    return "upstream-active";
  }
  const slots = ctx.slots;
  const slotsProxy = new Proxy(slots, {
    get(target, property) {
      if (property !== "register") {
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      }
      return (options: WorkspaceRegistration, component: unknown) => {
        const rawRegister = target.register as unknown as (
          entry: WorkspaceRegistration,
          entryComponent: unknown,
        ) => () => void;
        const register = (
          entry: WorkspaceRegistration,
          entryComponent: unknown,
        ) => rawRegister.call(target, entry, entryComponent);
        if (options.name !== "sidebar.workspaces") {
          return register(options, component);
        }
        const entry: StoredWorkspaceEntry = { ...options, component };
        if (!isCompatibleEntry(entry)) {
          console.warn(
            "draft workspace replacement compatibility check failed; using the upstream browser",
          );
          return register(options, component);
        }
        const upstreamInject = options.inject as (
          ...args: never[]
        ) => Record<string, unknown>;
        const inject = (...args: never[]) => {
          const injected = upstreamInject(...args);
          const hooks = (injected.hooks ?? {}) as Record<string, unknown>;
          return {
            ...injected,
            hooks: { ...hooks, drafts: source },
          };
        };
        return register(
          { ...options, inject },
          replacementComponent(
            ctx,
            source,
            component as ComponentType<WorkspaceBrowserProps>,
          ),
        );
      };
    },
  });
  const contextProxy = new Proxy(ctx, {
    get(target, property) {
      if (property === "slots") return slotsProxy;
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  applyUpstreamWorkspace(contextProxy as Context);
  return "activated";
}
