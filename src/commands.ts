// @ts-nocheck
// Cross-app slash-commands for opencode-loader. Unlike the bundled plugins, the
// loader is a tsc-compiled package loaded via opencode (not a single file at
// plugin/<name>.js), so its command shells point at the loader's real runtime
// entry (where `../core/dist` resolves) rather than the {{BUNDLE}} convention.
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { deployCommands, runConfigCli } from "../core/dist/index.js";

const PLUGIN = "opencode-loader";

// The loader's runtime entry: prefer the plugin-updater repo build, fall back to
// opencode's package cache. Relative imports (../core/dist) resolve from here.
function loaderEntry(configDir) {
  const candidates = [
    join(configDir, "repos", "opencode-loader", "dist", "plugin.js"),
    join(homedir(), ".cache", "opencode", "packages", "opencode-loader@latest", "node_modules", "opencode-loader", "dist", "plugin.js"),
  ];
  return candidates.find((c) => existsSync(c)) || candidates[0];
}

function commandDefs(entry) {
  const node = `node "${entry}"`;
  return [
    {
      name: "opencode-loader-config",
      description: "View/change opencode-loader configuration",
      argumentHint: "list | get <key> | set <key> <value>",
      shell: `${node} config $ARGUMENTS`,
      body: "Above is the opencode-loader config result. Report it; if the user changed a setting, confirm the new value.",
    },
    {
      name: "plugins",
      description: "List the loader-managed plugins (from plugins.json)",
      shell: `${node} plugins`,
      body: "Above are the installed plugins and their state. Report them.",
    },
    {
      name: "accounts",
      description: "List signed-in accounts across all providers",
      shell: `${node} accounts`,
      body: "Above are the signed-in accounts across every provider. Report them; if none, tell the user to log in (oc auth login).",
    },
  ];
}

export function deployLoaderCommands(configDir) {
  try {
    deployCommands(PLUGIN, commandDefs(loaderEntry(configDir)));
  } catch {
    /* best-effort */
  }
}

function listPlugins(configDir) {
  for (const p of [join(configDir, "config", "plugins.json"), join(configDir, "plugins.json")]) {
    if (!existsSync(p)) continue;
    try {
      const arr = JSON.parse(readFileSync(p, "utf8"));
      if (!Array.isArray(arr) || !arr.length) return console.log("No plugins configured.");
      for (const e of arr) console.log(`- ${e.name}${e.enabled === false ? " (disabled)" : ""}${e.sync ? " [sync]" : ""}`);
      return;
    } catch { /* try next */ }
  }
  console.log("No plugins.json found.");
}

function listAccounts(configDir) {
  for (const p of [join(configDir, "config", "core-auth-accounts.json"), join(configDir, "core-auth-accounts.json")]) {
    if (!existsSync(p)) continue;
    try {
      const store = JSON.parse(readFileSync(p, "utf8"));
      const lines = [];
      for (const provider of Object.keys(store)) {
        const accts = Array.isArray(store[provider]) ? store[provider] : (store[provider]?.accounts || []);
        for (const a of accts) lines.push(`- [${provider}] ${a.email || a.id}${a.enabled === false ? " (disabled)" : ""}`);
      }
      return console.log(lines.length ? lines.join("\n") : "No accounts signed in.");
    } catch { /* try next */ }
  }
  console.log("No accounts store found.");
}

// If invoked as `node <loader-entry> <action>`, run the action and return true.
export async function maybeRunCli(configDir) {
  const argv = process.argv.slice(2);
  if (argv[0] === "config") {
    runConfigCli(PLUGIN, argv.slice(1));
    return true;
  }
  if (argv[0] === "plugins") {
    listPlugins(configDir);
    return true;
  }
  if (argv[0] === "accounts") {
    listAccounts(configDir);
    return true;
  }
  return false;
}
