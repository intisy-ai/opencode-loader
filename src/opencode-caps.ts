// @ts-nocheck
// opencode adapter for core-loader's app-capability contract (see
// libs/core-loader "S.capabilities" / tuiApi.registerCapabilities). opencode
// registers ONLY the MCP subset here: it has its own in-app session UI and no
// plugin marketplace, so listSessions/foreignPlugins/marketplaces/addMarketplace
// are intentionally never registered for this loader.
//
// opencode's MCP servers live in the app config file itself:
//   ~/.config/opencode/opencode.jsonc (preferred if present) or opencode.json
//   (HUB_CONFIG_DIR overrides the ~/.config/opencode root, same as tui-extension.ts).
// That file is JSONC (supports // and /* */ comments), so reads strip comments
// before parsing; writes go through JSON.stringify (comments are lost on rewrite,
// matching repo convention: the DATA is what must be preserved).
// Shape (opencode's own config.json schema, https://opencode.ai/config.json):
//   { "mcp": { "<name>": { "type": "local", "command": [...], "environment"?: {},
//                            "cwd"?: "...", "timeout"?: n, "enabled"?: bool }
//            | { "type": "remote", "url": "...", "headers"?: {}, "oauth"?: {},
//                "timeout"?: n, "enabled"?: bool } } }

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { loaderConfigDir } from "@intisy-ai/core-loader/dist/app-home.js";
import { readDeployedManifests } from "@intisy-ai/core-loader/dist/plugin-manifests.js";
import { homePaths } from "@intisy-ai/core-loader/dist/home-paths.js";

const APP_HOME = join(homedir(), ".config", "opencode");
function configDir() { return loaderConfigDir(APP_HOME); }

// opencode.jsonc wins over opencode.json when both exist.
export function opencodeConfigPath() {
  return join(configDir(), existsSync(join(configDir(), "opencode.jsonc")) ? "opencode.jsonc" : "opencode.json");
}

// String-aware JSONC comment stripper: removes // line and /* */ block comments
// but never touches // that appears inside a JSON string (e.g. "http://host").
function stripJsonc(text) {
  var out = "", inStr = false, esc = false, i = 0;
  while (i < text.length) {
    var c = text[i], n = text[i + 1];
    if (inStr) { out += c; if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; i++; continue; }
    if (c === '"') { inStr = true; out += c; i++; continue; }
    if (c === "/" && n === "/") { while (i < text.length && text[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*") { i += 2; while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++; i += 2; continue; }
    out += c; i++;
  }
  return out;
}

// Quote-aware command tokenizer so paths with spaces survive
// (e.g. '"C:\\Program Files\\node.exe" script.js' -> two tokens, not four).
function splitCommand(s) {
  var out = [], cur = "", q = false, i = 0;
  for (; i < s.length; i++) {
    var c = s[i];
    if (c === '"') { q = !q; continue; }
    if (c === " " && !q) { if (cur) { out.push(cur); cur = ""; } continue; }
    cur += c;
  }
  if (cur) out.push(cur);
  return out;
}

function readJsonSafe(path, fallback) {
  try { return JSON.parse(stripJsonc(readFileSync(path, "utf8"))); } catch (e) { return fallback; }
}

export function mcpServers() {
  try {
    var cfg = readJsonSafe(opencodeConfigPath(), {}) || {};
    var mcp = (cfg && typeof cfg.mcp === "object" && cfg.mcp) || {};
    return Object.keys(mcp).map(function (name) {
      var c = mcp[name] || {};
      var transport = c.type === "remote" ? "http" : "stdio";
      var detail = c.type === "remote" ? (c.url || "") : (Array.isArray(c.command) ? c.command.join(" ") : (c.command || ""));
      return { name: name, transport: transport, detail: detail };
    });
  } catch (e) { return []; }
}

// JSON read-modify-write into opencode's own config file; no CLI dependency.
// http -> {type:"remote", url}; stdio -> {type:"local", command:[...]}, splitting
// a plain "cmd arg1 arg2" target string (quote-aware) into the command array.
// CRITICAL: opencode.jsonc may contain comments and the user's entire
// provider/model/other-mcp config. If an existing, non-empty config file fails
// to parse, ABORT the write rather than clobber that data with a fresh object.
export function addMcpServer(spec) {
  try {
    var name = spec && spec.name;
    var transport = spec && spec.transport;
    var target = spec && spec.target;
    if (!name) return { ok: false, error: "missing name" };
    if (!target) return { ok: false, error: "missing target" };
    var path = opencodeConfigPath();
    var cfg = {};
    if (existsSync(path)) {
      var raw = readFileSync(path, "utf8");
      if (raw && raw.trim()) {
        try { cfg = JSON.parse(stripJsonc(raw)); }
        catch (e) { return { ok: false, error: "opencode config could not be parsed — not modifying it to avoid data loss" }; }
      }
    }
    if (!cfg || typeof cfg !== "object") cfg = {};
    if (!cfg.mcp || typeof cfg.mcp !== "object") cfg.mcp = {};
    if (transport === "http") {
      cfg.mcp[name] = { type: "remote", url: target, enabled: true };
    } else {
      var command = Array.isArray(target) ? target : splitCommand(String(target));
      cfg.mcp[name] = { type: "local", command: command, enabled: true };
    }
    writeFileSync(path, JSON.stringify(cfg, null, 2), "utf8");
    return { ok: true };
  } catch (e) { return { ok: false, error: (e && e.message) || String(e) }; }
}

// Which deployed plugin provides a capability, given what a home's manifests declare. A capability
// id is the only key: no plugin is named here, and an id this loader has never heard of answers
// exactly like one it has.
export function ownerOfCapability(manifests, capabilityId, urlFor) {
  for (const manifest of manifests || []) {
    const declared = (manifest && manifest.capabilities) || [];
    if (declared.indexOf(capabilityId) === -1) continue;
    return { id: manifest.id, url: urlFor ? urlFor(manifest.id) : undefined };
  }
  return null;
}

function urlFromPluginList(paths, id) {
  try {
    const listed = JSON.parse(readFileSync(join(paths.configFolder, "plugins.json"), "utf8"));
    const entry = (listed || []).find((item) => item && item.name === id);
    return entry && typeof entry.url === "string" ? entry.url : undefined;
  } catch {
    return undefined;
  }
}

// The plugin that provides a capability in THIS home, read from the manifest sidecars deploy
// writes beside each bundle. Never throws into the TUI: an unreadable home answers null, which
// every caller already renders as "nothing offers this".
export function pluginByCapability(capabilityId) {
  try {
    const paths = homePaths(loaderConfigDir(APP_HOME));
    const manifests = readDeployedManifests(paths.pluginDir).loaded.map((entry) => entry.manifest);
    return ownerOfCapability(manifests, capabilityId, (id) => urlFromPluginList(paths, id));
  } catch {
    return null;
  }
}
