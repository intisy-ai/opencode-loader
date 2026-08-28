import { existsSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";
import { maybeRunCli, deployLoaderCommands } from "./commands.js";
import { getBinDir, runEarlyLaunchHooks, ensureOnPath } from "@intisy-ai/core-loader/dist/loader-runtime.js";
import { cliDispatchCmdLines, cliDispatchShLines, tuiCandidateResolveShLines, subdirEnvCmdLines, subdirEnvShLines } from "@intisy-ai/core-loader/dist/wrapper.js";
import { getAppDescriptor, getAppConfigDir, makeWriteLog, defineConfig, defineReadme, maybeRunReadmeCli, createActivitySeam } from "@intisy-ai/core";
import { ensureAppCli } from "@intisy-ai/core-loader/dist/ensure-app.js";
import { setActivitySeam, emitPluginActivated } from "@intisy-ai/core-loader/dist/activity-seam.js";
import { ensureProxy } from "./proxy-boot.js";
import { deployFrontDoor } from "@intisy-ai/opencode-proxy";

// Slash-command invocations shell in as `node <this file> <action>`; handle them
// first and exit, so command/config runs never go through plugin activation.
// Register config defaults BEFORE the CLI guard so `config schema` sees them (no write).
// use_proxy is opt-in (default false): OpenCode routes in-process by default; when
// enabled, requests are forwarded to a local opencode-proxy daemon on proxy_port.
const LOADER_CONFIG = defineConfig("opencode-loader", {
  logging: true,
  auto_update_check: true,
  update_check_delay_ms: 1500,
  update_check_interval_hours: 24,
  catalog_cache_hours: 6,
  default_tab: "projects",
  use_proxy: false,
  proxy_port: 34568,
});

defineReadme({
  description:
    "TUI launcher and `oc` shell command for [OpenCode](https://github.com/sst/opencode). When loaded as an OpenCode plugin it installs an `oc` command into your shell; running `oc` opens an interactive TUI for switching between projects, managing plugins, and signing in to providers. It also drives [plugin-updater](https://github.com/intisy-ai/plugin-updater) on startup so all your git-based plugins stay current.",
  architecture: `flowchart TD
    START[OpenCode startup] -->|activate| PLUGIN[plugin.js]
    PLUGIN -->|earlyLaunch| UPDATER[plugin-updater]
    PLUGIN -->|install| OCBIN["oc / oc.cmd in ~/.local/bin"]
    PLUGIN -->|deployCommands| CMDS["/opencode-loader-config, /plugins, /accounts"]
    OCBIN -->|run oc| TUI["core-loader TUI (node tui.js)"]
    TUI --> PROJ[Projects tab]
    TUI --> PLUG[Plugins tab]
    TUI --> PROV[Providers tab (tui-extension.js)]
    PROV --> COREAUTH[(core-auth account store)]`,
  structure: {
    src: [
      "`plugin.ts`: the OpenCode plugin entry (`activate`/`cleanup`); installs the `oc` wrapper, runs plugin-updater, deploys commands. Also acts as the command CLI (`node plugin.js <config|plugins|accounts>`).",
      "`tui-extension.ts`: the loader's custom Providers tab (auto-discovers installed providers).",
      "`commands.ts`: cross-app slash-command definitions + their CLI actions.",
    ],
    dist: ["compiled output (generated; not committed)."],
  },
  dependencies: ["core-loader", "core", "plugin-updater", "Bun"],
  extraSections: [
    {
      id: "requirements",
      title: "Requirements",
      after: "structure",
      body: "- Node.js 20+ (the TUI runs under Node, no Bun required; it reads the OpenCode session DB via Node 22+'s built-in `node:sqlite`, falling back to `bun:sqlite` when run under Bun).",
    },
    {
      id: "loader-install-detail",
      title: "Plugin-updater entry",
      after: "installation",
      body: [
        "When using plugin-updater, add this entry to `~/.config/opencode/config/plugins.json`:",
        "",
        "```json",
        '{ "name": "opencode-loader", "url": "https://github.com/intisy-ai/opencode-loader", "enabled": true, "autoUpdate": true }',
        "```",
        "Restart OpenCode; the updater clones, builds and loads it.",
        "",
        "When using npm directly, add to `~/.config/opencode/opencode.json`:",
        "",
        "```jsonc",
        '{ "plugins": ["opencode-loader@latest"] }',
        "```",
      ].join("\n"),
    },
    {
      id: "usage",
      title: "Usage",
      after: "loader-install-detail",
      body: [
        "```bash",
        "oc              # Launch the TUI",
        "oc 3            # Open project #3 directly",
        "oc myproject    # Open the first project matching \"myproject\"",
        "```",
        "",
        "### Keyboard shortcuts",
        "",
        "| Key | Projects tab | Plugins tab |",
        "|-----|--------------|-------------|",
        "| ↑↓ / W S | Navigate | Navigate |",
        "| Enter | Open action menu | Open action menu |",
        "| O | Open project | - |",
        "| P | Pin/Unpin | - |",
        "| H / U | Hide / Unhide all | - |",
        "| F | - | Fetch remote updates |",
        "| A | - | Toggle auto-update |",
        "| ← → | Switch tabs | Switch tabs |",
        "| Q | Quit | Quit |",
      ].join("\n"),
    },
    {
      id: "commands-loader",
      title: "Commands",
      after: "usage",
      body: [
        "Deployed automatically on activation to both apps' command directories (`~/.config/opencode/command/` and `~/.claude/commands/`):",
        "",
        "| Command | Description |",
        "| --- | --- |",
        "| `/opencode-loader-config` | View/change loader config (`opencode-loader.json`): `list`, `get <key>`, `set <key> <value>`. 100% of the config is reachable here. |",
        "| `/plugins` | List the loader-managed plugins and their state (from `plugins.json`). |",
        "| `/accounts` | List signed-in accounts across all providers (from the core-auth store). |",
      ].join("\n"),
    },
    {
      id: "config-extra",
      title: "Configuration (extra)",
      after: "configuration",
      body: "The TUI also stores its own settings in `config/oc-config.json` and the plugin list in `config/plugins.json`.",
    },
  ],
});

if (maybeRunReadmeCli("opencode-loader")) process.exit(0);

if (await maybeRunCli(getAppConfigDir())) {
  process.exit(0);
}

// Delegates to the shared core logger (per-plugin prefix/color + GLOBAL console toggle).
function writeLog(configDir: string, message: string, isError: boolean = false) {
  makeWriteLog("opencode-loader", configDir)(message, isError);
}


function installOcWrapper(configDir: string) {
  const binDir = getBinDir();
  if (!existsSync(binDir)) try { mkdirSync(binDir, { recursive: true }); } catch {}
  ensureOnPath(binDir, (m) => writeLog(configDir, m));

  const pluginDir = dirname(fileURLToPath(import.meta.url));
  // resolved at every oc invocation, not at install time, so the wrapper
  // works as soon as any copy of the TUI exists and never goes stale
  const tuiCandidates = [
    // core-loader is the primary location; the bare "core" paths are kept as
    // fallbacks for installs whose TUI still lives there.
    join(pluginDir, "..", "core-loader", "dist", "tui.js"),
    join(configDir, "repos", "opencode-loader", "core-loader", "dist", "tui.js"),
    join(homedir(), ".cache", "opencode", "packages", "opencode-loader@latest", "node_modules", "opencode-loader", "core-loader", "dist", "tui.js"),
    join(pluginDir, "..", "core", "dist", "tui.js"),
    join(configDir, "repos", "opencode-loader", "core", "dist", "tui.js"),
    join(homedir(), ".cache", "opencode", "packages", "opencode-loader@latest", "node_modules", "opencode-loader", "core", "dist", "tui.js"),
  ];
  const cliCandidates = tuiCandidates.map((p) => p.replace(/tui\.js$/, "cli.js"));
  // the loader's own custom Providers tab (auto-discovers all installed providers)
  const extPath = join(configDir, "repos", "opencode-loader", "dist", "tui-extension.js");
  writeLog(configDir, "Installing oc wrapper with runtime TUI resolution");

  if (process.platform === "win32") {
    const cmdPath = join(binDir, "oc.cmd");
    const cmdLines = [
      "@echo off",
      "setlocal",
      'set "HUB_CONFIG_DIR=%USERPROFILE%\\.config\\opencode"',
      // injects this app's identity into core-loader (which otherwise defaults to
      // OpenCode), symmetric with claude-code-loader's cc.cmd wrapper
      ...subdirEnvCmdLines(getAppDescriptor("opencode")?.paths ?? {}),
      "set HUB_APP_NAME=OpenCode",
      "set HUB_CLI_CMD=opencode",
      // core-loader is app-agnostic and must not guess this; must match the manifest app.id.
      "set HUB_APP_ID=opencode",
      "set HUB_NPM_PKG=opencode-ai",
      `set "HUB_TUI_EXTENSION=${extPath}"`,
    ];
    cmdLines.push(...cliDispatchCmdLines(cliCandidates));
    for (const candidate of tuiCandidates) {
      cmdLines.push(`if exist "${candidate}" ( node "${candidate}" %* & exit /b %errorlevel% )`);
    }
    cmdLines.push("opencode %*");
    writeFileSync(cmdPath, cmdLines.join("\r\n") + "\r\n", "utf-8");
    try { const fs = require("fs"); fs.unlinkSync(join(binDir, "oc")); } catch {}
  } else {
    const shPath = join(binDir, "oc");
    const lines = [
      "#!/bin/sh",
      'export PATH="$HOME/.bun/bin:$PATH"',
      // tell core-auth (loaded via each provider's handler) which app home we're in, so
      // its model refresh writes opencode.json instead of falling back to ~/.claude
      'export HUB_CONFIG_DIR="$HOME/.config/opencode"',
      // injects this app's identity into core-loader (which otherwise defaults to
      // OpenCode), symmetric with claude-code-loader's cc wrapper
      ...subdirEnvShLines(getAppDescriptor('opencode')?.paths ?? {}),
      'export HUB_APP_NAME="OpenCode"',
      'export HUB_CLI_CMD="opencode"',
      // core-loader is app-agnostic and must not guess this; must match the manifest app.id.
      'export HUB_APP_ID="opencode"',
      'export HUB_NPM_PKG="opencode-ai"',
      `export HUB_TUI_EXTENSION="${extPath}"`,
      ...tuiCandidateResolveShLines(tuiCandidates),
      ...cliDispatchShLines(cliCandidates),
      'if [ -z "$TUI" ] || ! command -v node >/dev/null 2>&1; then exec opencode "$@"; fi',
      'export OC_OUTPUT="${TEMP:-${TMPDIR:-/tmp}}/oc-dir-$$.txt"',
      'node "$TUI" "$@"',
      "EXIT=$?",
      'if [ $EXIT -eq 42 ]; then',
      '  rm -f "$OC_OUTPUT"',
      '  exec opencode "$@"',
      "fi",
      'if [ $EXIT -eq 0 ] && [ -f "$OC_OUTPUT" ]; then',
      '  DIR=$(cat "$OC_OUTPUT")',
      '  rm -f "$OC_OUTPUT"',
      '  if [ -n "$DIR" ]; then cd "$DIR" && exec opencode; fi',
      "fi",
      'rm -f "$OC_OUTPUT"',
      "exit $EXIT",
    ];
    writeFileSync(shPath, lines.join("\n") + "\n", { mode: 0o755 });
    try { require("child_process").execSync(`chmod +x "${shPath}"`); } catch {}
    try { const fs = require("fs"); fs.unlinkSync(join(binDir, "oc.cmd")); } catch {}
  }

  writeLog(configDir, "oc wrapper installed successfully");
}

/** Removes what this loader installed into a home: its wrapper, its commands and its hooks. */
export async function cleanup(configDir?: string) {
  // opencode invokes every exported function as a plugin hook, passing a context
  // object; return an inert plugin instance in that case.
  if (typeof configDir !== "string") return {};
  // Intentionally does NOT remove the oc wrapper. plugin-updater calls cleanup()
  // before EVERY redeploy; if the earlyLaunch process is killed after the copy but
  // before activate() re-installs the wrapper, removing it here would leave the user
  // with no `oc` command. activate() rewrites the wrapper idempotently, and the
  // existing wrapper targets stable repo paths so it keeps working across updates.
  return {};
}

/** The app's own load hook: wires activity, deploys the commands and the wrapper, and runs the update pass. */
export async function activate() {
  const configDir = getAppConfigDir();
  try {
    setActivitySeam(createActivitySeam("opencode-loader"));
    emitPluginActivated("opencode-loader");
  } catch (e) {
    writeLog(configDir, "Failed to wire activity: " + e, true);
  }
  writeLog(configDir, "OpenCode Loader activating");

  try {
    await runEarlyLaunchHooks(configDir, (m) => writeLog(configDir, m));
  } catch (e) {
    writeLog(configDir, "Failed during earlyLaunch hooks: " + e, true);
  }

  try {
    ensureAppCli({ binary: "opencode", pkg: "opencode-ai" }, (m) => writeLog(configDir, m));
  } catch (e) {
    writeLog(configDir, "Failed to ensure app CLI: " + e, true);
  }

  try {
    installOcWrapper(configDir);
  } catch (e) {
    writeLog(configDir, "Failed to install oc wrapper: " + e, true);
  }

  try {
    deployLoaderCommands(configDir);
  } catch (e) {
    writeLog(configDir, "Failed to deploy loader commands: " + e, true);
  }

  // Best-effort convenience: lands opencode-proxy's generic front-door file even
  // when the loader (not opencode-proxy itself) drives setup.
  try {
    deployFrontDoor(configDir);
  } catch (e) {
    writeLog(configDir, "Failed to deploy front-door: " + e, true);
  }

  // Opt-in only: no-op unless config use_proxy=true. Runs in the OpenCode process,
  // so the env it sets is visible to core-auth's loader.fetch in the same process.
  try {
    await ensureProxy(LOADER_CONFIG, (m: string) => writeLog(configDir, m));
  } catch (e) {
    writeLog(configDir, "Failed to ensure opencode proxy: " + e, true);
  }

  writeLog(configDir, "OpenCode Loader activation complete");
  return {};
}
