import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-api-gateway/client";
import draftSessionsRemote from "../remote.js";

export type * from "../shared/types.js";

export const inject = ["remote"];

/** Mount the strict draftSessions Remote namespace into the Web client. */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  return ctx.remote.$mount(draftSessionsRemote);
}
