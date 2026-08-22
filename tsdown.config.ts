import { readFileSync } from "node:fs";
import { defineConfig, type UserConfig } from "tsdown";

const ID = "dsh-draft-sessions";
const CLIENT_EXTERNALS = [
  "@deepseek-ai/cordis",
  "@deepseek-ai/dsh-api-gateway/client",
  "@deepseek-ai/dsh-client-connection/client",
  "@deepseek-ai/dsh-client-runtime/client",
  "@deepseek-ai/dsh-client-ui-conversation/client",
  "@deepseek-ai/dsh-typert-protocol",
  "react",
];

const WORKSPACE_CLIENT_ID = "@deepseek-ai/dsh-client-ui-workspace";
const WORKSPACE_CLIENT_MODULE_ID = `${WORKSPACE_CLIENT_ID}/client`;
const VIRTUAL_WORKSPACE_CLIENT_ID = `\0${WORKSPACE_CLIENT_MODULE_ID}`;
const workspaceClientEntry = import.meta.resolve(WORKSPACE_CLIENT_MODULE_ID);
const workspaceClientBundle = readFileSync(
  new URL(workspaceClientEntry),
  "utf8",
);
const factoryPrefix = "factory: (require) => {";
const factorySuffix = "\n\t}\n});";
const factoryStart = workspaceClientBundle.indexOf(factoryPrefix);
const factoryEnd = workspaceClientBundle.lastIndexOf(factorySuffix);
if (factoryStart < 0 || factoryEnd < factoryStart) {
  throw new Error(
    `cannot extract the pinned ${WORKSPACE_CLIENT_ID} client factory`,
  );
}
const workspaceClientFactoryBody = workspaceClientBundle.slice(
  factoryStart + factoryPrefix.length,
  factoryEnd,
);
const inlineWorkspaceClient = {
  name: "inline-pinned-workspace-client",
  resolveId(id: string) {
    return id === WORKSPACE_CLIENT_MODULE_ID
      ? VIRTUAL_WORKSPACE_CLIENT_ID
      : undefined;
  },
  load(id: string) {
    if (id !== VIRTUAL_WORKSPACE_CLIENT_ID) return undefined;
    return [
      "const workspaceClient = ((require) => {",
      workspaceClientFactoryBody,
      "})(require);",
      "export const apply = workspaceClient.apply;",
    ].join("\n");
  },
};

const configs = [
  {
    name: ID,
    entry: {
      index: "src/index.ts",
      remote: "src/remote.ts",
      "shared/types": "src/shared/types.ts",
    },
    outDir: "lib",
    format: ["esm"],
    platform: "node",
    target: "es2022",
    fixedExtension: false,
    dts: false,
    clean: true,
  },
  {
    name: `${ID}/client`,
    entry: { client: "src/client/index.ts" },
    outDir: "lib",
    format: ["cjs"],
    platform: "browser",
    target: "es2022",
    dts: false,
    sourcemap: true,
    clean: false,
    deps: {
      neverBundle: CLIENT_EXTERNALS,
      alwaysBundle: (id: string) => !CLIENT_EXTERNALS.includes(id),
    },
    plugins: [inlineWorkspaceClient],
    outputOptions: {
      entryFileNames: "client.js",
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
      footer: "return module.exports; } });",
      intro: "var module = { exports: {} }; var exports = module.exports;",
    },
  },
] satisfies UserConfig[];

export default defineConfig(configs);
