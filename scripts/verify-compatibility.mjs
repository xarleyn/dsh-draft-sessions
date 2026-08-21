import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const compatibility = JSON.parse(
  await readFile(new URL("../compatibility.json", import.meta.url), "utf8"),
);
const expected =
  compatibility.deepseekHarness.packages[
    "@deepseek-ai/dsh-client-ui-workspace"
  ];
const installed = JSON.parse(
  await readFile(
    fileURLToPath(
      import.meta.resolve("@deepseek-ai/dsh-client-ui-workspace/package.json"),
    ),
    "utf8",
  ),
).version;

if (installed !== expected) {
  throw new Error(
    `ui-workspace compatibility mismatch: expected ${expected}, installed ${installed}`,
  );
}
