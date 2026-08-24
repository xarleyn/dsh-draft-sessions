import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("draft sidebar source boundaries", () => {
  it("keeps the public view module as a small compatibility facade", async () => {
    const facade = await readFile("src/client/draft-sidebar-view.ts", "utf8");
    expect(facade.split(/\r?\n/u).length).toBeLessThan(12);
    for (const module of ["hooks", "menu", "row", "styles", "types", "view"]) {
      await expect(
        readFile(`src/client/draft-sidebar/${module}.ts`, "utf8"),
      ).resolves.toBeTruthy();
    }
  });
});
