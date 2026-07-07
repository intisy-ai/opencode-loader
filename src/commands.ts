// @ts-nocheck
// Cross-app slash-commands for opencode-loader. The shared engine lives in
// core-loader (makeLoaderCommands); this only wires the app-specific bits: the
// opencode command dir, the loader's runtime entry, and the `oc auth login` hint.
import { join } from "path";
import { existsSync } from "fs";
import { homedir } from "os";
import { runConfigCli } from "../core/dist/index.js";
import { makeLoaderCommands } from "../core-loader/dist/loader-commands.js";

function loaderEntry(configDir) {
  const candidates = [
    join(configDir, "repos", "opencode-loader", "dist", "plugin.js"),
    join(homedir(), ".cache", "opencode", "packages", "opencode-loader@latest", "node_modules", "opencode-loader", "dist", "plugin.js"),
  ];
  return candidates.find((c) => existsSync(c)) || candidates[0];
}

const commands = makeLoaderCommands({
  plugin: "opencode-loader",
  commandDir: "command",
  loaderEntry,
  runConfigCli,
  authHint: "tell the user to log in (oc auth login)",
});

export const deployLoaderCommands = commands.deployLoaderCommands;
export const maybeRunCli = commands.maybeRunCli;
