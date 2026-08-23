import { readFile } from "node:fs/promises";

const client = await readFile(
  new URL("../lib/client.js", import.meta.url),
  "utf8",
);
const draftRegistration = client.indexOf('id: "dsh-draft-sessions"');

if (draftRegistration < 0) {
  throw new Error("client bundle is missing the draft-sessions factory");
}
if (client.includes("dsh-client-ui-workspace")) {
  throw new Error(
    "client bundle must not embed or require a workspace-browser implementation",
  );
}
if (!client.includes('"sidebar.workspaces.before"')) {
  throw new Error("client bundle is missing the additive draft-row seat");
}
if (!client.includes("excludeSessionRows")) {
  throw new Error("client bundle is missing slot-local shell exclusion");
}
if (client.includes("upstream occupant")) {
  throw new Error("client bundle retains the obsolete occupant warning path");
}
