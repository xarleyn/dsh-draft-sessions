import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

describe("DraftReporter", () => {
  it("uses one named Cordis logger and preserves the cause", async () => {
    const reporterModule = await import("../src/client/reporter.js").catch(
      () => undefined,
    );
    expect(reporterModule).toBeDefined();
    if (reporterModule === undefined) return;

    const error = vi.fn();
    const logger = vi.fn(() => ({ error }));
    const cause = new Error("offline");
    const reporter = new reporterModule.DraftReporter({ logger } as never);
    reporter.error("draft-open", cause);

    expect(logger).toHaveBeenCalledWith("dsh-draft-sessions");
    expect(error).toHaveBeenCalledWith("[%s] %o", "draft-open", cause);
  });

  it("keeps direct console calls out of client production code", async () => {
    const files = [
      "sidebar.ts",
      "lifecycle.ts",
      "shortcut.ts",
      "workspace-contribution.ts",
    ];
    for (const file of files) {
      expect(await readFile(`src/client/${file}`, "utf8")).not.toMatch(
        /console\./u,
      );
    }
  });
});
