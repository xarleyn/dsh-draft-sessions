import { describe, expect, it } from "vitest";

const budgetModule = await import("../scripts/client-bundle-budget.mjs").catch(
  () => undefined,
);

describe("client bundle budget", () => {
  it("provides the bundle budget verifier", () => {
    expect(budgetModule).toBeDefined();
  });

  it("accepts a bundle at the 80 KiB limit", () => {
    if (!budgetModule) return;

    expect(
      budgetModule.verifyClientBundleBudget(
        "x".repeat(budgetModule.CLIENT_BUNDLE_BUDGET),
        '{"sources":[]}',
      ),
    ).toEqual({
      bytes: budgetModule.CLIENT_BUNDLE_BUDGET,
      budget: budgetModule.CLIENT_BUNDLE_BUDGET,
    });
  });

  it("rejects a bundle over the 80 KiB limit", () => {
    if (!budgetModule) return;

    expect(() =>
      budgetModule.verifyClientBundleBudget(
        "x".repeat(budgetModule.CLIENT_BUNDLE_BUDGET + 1),
        '{"sources":[]}',
      ),
    ).toThrow(/exceeds the 80 KiB budget/u);
  });

  it("rejects Zod in the client bundle source map", () => {
    if (!budgetModule) return;

    expect(() =>
      budgetModule.verifyClientBundleBudget(
        "client bundle",
        '{"sources":["../node_modules/zod/v4/core/schemas.js"]}',
      ),
    ).toThrow(/must not contain Zod/u);
  });
});
