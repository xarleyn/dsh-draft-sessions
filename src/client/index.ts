import type { Context } from "@deepseek-ai/cordis";
import type {
  ConnectionHandle,
  IApiClient,
} from "@deepseek-ai/dsh-client-connection/client";
import type {
  ISessions,
  IWorkspaces,
} from "@deepseek-ai/dsh-client-runtime/client";
import type { IConversation } from "@deepseek-ai/dsh-client-ui-conversation/client";
import type {} from "@deepseek-ai/dsh-api-gateway/client";
import draftSessionsRemote from "../remote.js";
import { DraftComposerBridge } from "./composer.js";
import { DraftSessionLifecycle } from "./lifecycle.js";
import { DraftSidebarSource } from "./sidebar.js";
import { DraftShortcutController } from "./shortcut.js";
import { activateWorkspaceReplacement } from "./workspace-replacement.js";

export type * from "../shared/types.js";
export * from "./composer.js";
export * from "./lifecycle.js";
export * from "./sidebar.js";
export * from "./shortcut.js";
export * from "./workspace-replacement.js";

declare module "@deepseek-ai/cordis" {
  interface Context {
    connection: ConnectionHandle & { readonly api: IApiClient };
    sessions: ISessions;
    workspaces: IWorkspaces;
    conversation: IConversation;
    draftSessionLifecycle: DraftSessionLifecycle;
    draftComposerBridge: DraftComposerBridge;
    draftShortcutController: DraftShortcutController;
    draftSidebarSource: DraftSidebarSource;
  }
}

export const inject = [
  "remote",
  "connection",
  "sessions",
  "workspaces",
  "conversation",
  "slots",
  "locale",
];

/** Mount the strict Remote namespace and its blank-Session lifecycle bridge. */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const dispose = await ctx.remote.$mount(draftSessionsRemote);
  const sidebar = new DraftSidebarSource(ctx);
  const lifecycle = new DraftSessionLifecycle(ctx, {
    drafts: ctx.remote.draftSessions,
    sessions: ctx.connection.api.sessions,
    sidebar,
  });
  const composer = new DraftComposerBridge(ctx, {
    lifecycle,
    drafts: ctx.remote.draftSessions,
    sessions: ctx.sessions,
    conversation: ctx.conversation,
    sidebar,
  });
  new DraftShortcutController(ctx, {
    lifecycle,
    composer,
    sessions: ctx.sessions,
    workspaces: ctx.workspaces,
  });
  activateWorkspaceReplacement(ctx, sidebar);
  return dispose;
}
