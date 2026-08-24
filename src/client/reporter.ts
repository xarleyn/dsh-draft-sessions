import type { Context, Logger } from "@deepseek-ai/cordis";

export type DraftReportEvent =
  "sidebar-refresh" | "draft-open" | "shortcut-create" | "session-finalize";

/** Named background-error boundary shared by one draft plugin activation. */
export class DraftReporter {
  private readonly logger: Logger;

  constructor(ctx: Pick<Context, "logger">) {
    this.logger = ctx.logger("dsh-draft-sessions");
  }

  error(event: DraftReportEvent, cause: unknown): void {
    this.logger.error("[%s] %o", event, cause);
  }
}
