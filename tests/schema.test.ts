import { describe, expect, it } from "vitest";

const validDraft = {
  version: 1,
  id: "draft-a",
  sessionId: null,
  workspaceId: "workspace-a",
  text: "unsent",
  createdAt: 1,
  updatedAt: 1,
  order: 0,
  state: "draft",
  revision: 1,
} as const;
const validDraftFile = { version: 1, drafts: [validDraft] } as const;

describe("strict draft schemas", () => {
  it("accepts a complete valid draft file", async () => {
    const schemas = await import("../src/shared/schema.js").catch(
      () => undefined,
    );
    expect(schemas).toBeDefined();
    if (schemas === undefined) return;
    expect(schemas.draftFileSchema.parse(validDraftFile)).toEqual(
      validDraftFile,
    );
  });

  it.each([
    { workspaceId: "w", unexpected: true },
    { workspaceId: "" },
    { workspaceId: "w", order: -1 },
    { workspaceId: "w", order: Number.MAX_SAFE_INTEGER + 1 },
  ])("rejects an invalid create request: %o", async (value) => {
    const schemas = await import("../src/shared/schema.js").catch(
      () => undefined,
    );
    expect(schemas).toBeDefined();
    if (schemas === undefined) return;
    expect(() => schemas.createDraftRequestSchema.parse(value)).toThrow();
  });

  it("rejects invalid states, nullable mistakes, and unknown fields", async () => {
    const schemas = await import("../src/shared/schema.js").catch(
      () => undefined,
    );
    expect(schemas).toBeDefined();
    if (schemas === undefined) return;
    expect(() =>
      schemas.draftSessionSchema.parse({ ...validDraft, state: "lost" }),
    ).toThrow();
    expect(() =>
      schemas.updateDraftRequestSchema.parse({
        id: "a",
        expectedRevision: 1,
        title: 4,
      }),
    ).toThrow();
    expect(() =>
      schemas.draftSessionSchema.parse({ ...validDraft, extra: true }),
    ).toThrow();
    expect(() =>
      schemas.draftFileSchema.parse({ ...validDraftFile, extra: true }),
    ).toThrow();
  });
});
