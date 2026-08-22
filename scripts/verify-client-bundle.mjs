import { readFile } from "node:fs/promises";

const client = await readFile(
  new URL("../lib/client.js", import.meta.url),
  "utf8",
);
const workspaceRegistration = client.indexOf(
  'id: "@deepseek-ai/dsh-client-ui-workspace"',
);
const draftRegistration = client.indexOf('id: "dsh-draft-sessions"');
const workspaceRequire = client.indexOf(
  'require("@deepseek-ai/dsh-client-ui-workspace/client")',
);

if (draftRegistration < 0) {
  throw new Error("client bundle is missing the draft-sessions factory");
}
if (workspaceRegistration >= 0) {
  throw new Error("workspace client must not register a second module factory");
}
if (workspaceRequire >= 0) {
  throw new Error("client bundle retains a runtime workspace-module require");
}
if (!client.includes('"conversation.hero.workspace"')) {
  throw new Error(
    "client bundle is missing the pinned workspace implementation",
  );
}
