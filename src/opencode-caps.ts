// @ts-nocheck
// opencode adapter for core-loader's app-capability contract (see
// libs/core-loader "S.capabilities" / tuiApi.registerCapabilities). opencode
// registers ONLY the MCP subset here — it has its own in-app session UI and no
// plugin marketplace, so listSessions/foreignPlugins/marketplaces/addMarketplace
// are intentionally never registered for this loader.
//
// opencode's MCP servers live in the app config file itself:
//   ~/.config/opencode/opencode.jsonc (preferred if present) or opencode.json
//   (HUB_CONFIG_DIR overrides the ~/.config/opencode root, same as tui-extension.ts).
// Shape (opencode's own config.json schema, https://opencode.ai/config.json):
//   { "mcp": { "<name>": { "type": "local", "command": [...], "environment"?: {},
//                            "cwd"?: "...", "timeout"?: n, "enabled"?: bool }
//            | { "type": "remote", "url": "...", "headers"?: {}, "oauth"?: {},
//                "timeout"?: n, "enabled"?: bool } } }

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

function configDir() { return process.env.HUB_CONFIG_DIR || join(homedir(), ".config", "opencode"); }

// opencode.jsonc wins over opencode.json when both exist (mirrors tui-extension.ts's opencodeConfigPath).
function opencodeConfigPath() {
  return join(configDir(), existsSync(join(configDir(), "opencode.jsonc")) ? "opencode.jsonc" : "opencode.json");
}

function readJsonSafe(path, fallback) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch (e) { return fallback; }
}

export function mcpServers() {
  try {
    const cfg = readJsonSafe(opencodeConfigPath(), {}) || {};
    const mcp = (cfg && typeof cfg.mcp === "object" && cfg.mcp) || {};
    return Object.keys(mcp).map((name) => {
      const c = mcp[name] || {};
      const transport = c.type === "remote" ? "http" : "stdio";
      const detail = c.type === "remote" ? (c.url || "") : (Array.isArray(c.command) ? c.command.join(" ") : (c.command || ""));
      return { name, transport, detail };
    });
  } catch (e) { return []; }
}

// JSON read-modify-write into opencode's own config file — no CLI dependency.
// http -> {type:"remote", url}; stdio -> {type:"local", command:[...]}, splitting
// a plain "cmd arg1 arg2" target string into the command array opencode expects.
export function addMcpServer(spec) {
  try {
    const name = spec && spec.name;
    const transport = spec && spec.transport;
    const target = spec && spec.target;
    if (!name) return { ok: false, error: "missing name" };
    if (!target) return { ok: false, error: "missing target" };
    const path = opencodeConfigPath();
    const cfg = readJsonSafe(path, {}) || {};
    if (!cfg.mcp || typeof cfg.mcp !== "object") cfg.mcp = {};
    if (transport === "http") {
      cfg.mcp[name] = { type: "remote", url: target, enabled: true };
    } else {
      const command = Array.isArray(target) ? target : String(target).split(" ").filter(Boolean);
      cfg.mcp[name] = { type: "local", command, enabled: true };
    }
    writeFileSync(path, JSON.stringify(cfg, null, 2), "utf8");
    return { ok: true };
  } catch (e) { return { ok: false, error: (e && e.message) || String(e) }; }
}
