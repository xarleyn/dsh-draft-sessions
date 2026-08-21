import type { Context } from "@deepseek-ai/cordis";
import type {
  SessionId,
  SessionListState,
  WorkspaceId,
  WorkspaceListState,
} from "@deepseek-ai/dsh-client-runtime/client";
import { createElement, type ComponentType } from "react";
import { apply as applyUpstreamWorkspace } from "@deepseek-ai/dsh-client-ui-workspace/client";
import type { DraftSession } from "../shared/types.js";
import {
  planDraftReorder,
  projectDraftSessions,
  projectDraftWorkspaces,
  type DraftSidebarSource,
} from "./sidebar.js";

type SelectorHook<State> = <Selected>(
  selector: (state: State) => Selected,
) => Selected;

interface WorkspaceBrowserProps {
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

function draftBySession(
  drafts: readonly DraftSession[],
): Map<string, DraftSession> {
  return new Map(
    drafts.flatMap((draft) =>
      draft.sessionId === null ? [] : [[draft.sessionId, draft] as const],
    ),
  );
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
    const bySession = draftBySession(drafts);
    const useSessions: SelectorHook<SessionListState> = (selector) =>
      props.useSessions((state) =>
        selector(projectDraftSessions(state, drafts)),
      );
    const useWorkspaces: SelectorHook<WorkspaceListState> = (selector) =>
      props.useWorkspaces((state) =>
        selector(projectDraftWorkspaces(state, drafts)),
      );
    const open = (sessionId: SessionId) => {
      const draft = bySession.get(sessionId);
      if (draft === undefined) props.open(sessionId);
      else void ctx.draftComposerBridge.open(draft);
    };
    const renameSession = async (sessionId: SessionId, title: string) => {
      const draft = bySession.get(sessionId);
      if (draft === undefined) return props.renameSession(sessionId, title);
      const result = await ctx.remote.draftSessions.update({
        id: draft.id,
        expectedRevision: draft.revision,
        title,
      });
      if (!result.ok) throw new Error(result.error.message);
      source.accept(result.value);
    };
    const forkSession = (sessionId: SessionId) => {
      const draft = bySession.get(sessionId);
      if (draft === undefined) return props.forkSession(sessionId);
      void ctx.draftSessionLifecycle
        .create({
          workspaceId: draft.workspaceId,
          text: draft.text,
          ...(draft.title === undefined ? {} : { title: draft.title }),
        })
        .then((created) => {
          source.accept(created);
          return ctx.draftComposerBridge.open(created);
        })
        .catch((error: unknown) => {
          console.error("draft fork failed", error);
        });
    };
    const archiveSession = async (sessionId: SessionId) => {
      const draft = bySession.get(sessionId);
      if (draft === undefined) return props.archiveSession(sessionId);
      const result = await ctx.remote.draftSessions.delete({
        id: draft.id,
        expectedRevision: draft.revision,
      });
      if (!result.ok) throw new Error(result.error.message);
      source.remove(draft.id);
    };
    const insertSessionBefore = async (
      workspaceId: WorkspaceId,
      sessionId: SessionId,
      beforeSessionId?: SessionId,
    ) => {
      const draft = bySession.get(sessionId);
      if (draft === undefined) {
        return props.insertSessionBefore(
          workspaceId,
          sessionId,
          beforeSessionId,
        );
      }
      const workspaceDrafts = drafts.filter(
        (item) => item.workspaceId === workspaceId,
      );
      const beforeDraft =
        beforeSessionId === undefined
          ? undefined
          : bySession.get(beforeSessionId)?.id;
      for (const update of planDraftReorder(
        workspaceDrafts,
        draft.id,
        beforeDraft,
      )) {
        const result = await ctx.remote.draftSessions.update(update);
        if (!result.ok) throw new Error(result.error.message);
        source.accept(result.value);
      }
    };
    return createElement(upstream, {
      ...props,
      useSessions,
      useWorkspaces,
      open,
      renameSession,
      forkSession,
      archiveSession,
      insertSessionBefore,
    });
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
