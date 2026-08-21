import type { Context } from "@deepseek-ai/cordis";
import type {
  ConnectionHandle,
  IApiClient,
} from "@deepseek-ai/dsh-client-connection/client";
import type {} from "@deepseek-ai/dsh-api-gateway/client";
import draftSessionsRemote from "../remote.js";
import { DraftSessionLifecycle } from "./lifecycle.js";

export type * from "../shared/types.js";
export * from "./lifecycle.js";

declare module "@deepseek-ai/cordis" {
  interface Context {
    connection: ConnectionHandle & { readonly api: IApiClient };
    draftSessionLifecycle: DraftSessionLifecycle;
  }
}

export const inject = ["remote", "connection"];

/** Mount the strict Remote namespace and its blank-Session lifecycle bridge. */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const dispose = await ctx.remote.$mount(draftSessionsRemote);
  new DraftSessionLifecycle(ctx);
  return dispose;
}
