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
import { DraftShortcutController } from "./shortcut.js";

export type * from "../shared/types.js";
export * from "./composer.js";
export * from "./lifecycle.js";
export * from "./shortcut.js";

declare module "@deepseek-ai/cordis" {
  interface Context {
    connection: ConnectionHandle & { readonly api: IApiClient };
    sessions: ISessions;
    workspaces: IWorkspaces;
    conversation: IConversation;
    draftSessionLifecycle: DraftSessionLifecycle;
    draftComposerBridge: DraftComposerBridge;
    draftShortcutController: DraftShortcutController;
  }
}

export const inject = [
  "remote",
  "connection",
  "sessions",
  "workspaces",
  "conversation",
];

/** Mount the strict Remote namespace and its blank-Session lifecycle bridge. */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const dispose = await ctx.remote.$mount(draftSessionsRemote);
  new DraftSessionLifecycle(ctx);
  new DraftComposerBridge(ctx);
  new DraftShortcutController(ctx);
  return dispose;
}
