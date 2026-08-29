// opencode adapter for basekit/loader's app-capability contract (see
// basekit's loader module ("S.capabilities" / tuiApi.registerCapabilities). opencode
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
import { loaderConfigDir } from "@intisy-ai/basekit/loader/app-home.js";
import { readDeployedManifests } from "@intisy-ai/api/host";
import { homePaths } from "@intisy-ai/basekit/loader/home-paths.js";
import type { HomePaths } from "@intisy-ai/basekit/loader/home-paths.js";
import type { CapabilityMcpServer, CapabilityResult, McpServerDraft } from "@intisy-ai/basekit/loader/app-capabilities.js";

/** One MCP server as this app's own config declares it, in either of the two shapes it supports. */
interface OpencodeMcpEntry {
  /** Which shape this is: a local command, or a remote endpoint. */
  type?: "local" | "remote";
  /** The command, for a local server, as an array or a single string. */
  command?: string[] | string;
  /** The endpoint, for a remote one. */
  url?: string;
  /** Whether this app loads it. */
  enabled?: boolean;
}

/** The part of this app's own config file this adapter reads and writes. */
interface OpencodeConfig {
  /** Each configured MCP server, by name. */
  mcp?: Record<string, OpencodeMcpEntry>;
}

/** The little of a deployed plugin's manifest a capability lookup needs. */
interface ManifestLike {
  /** The plugin's id. */
  id: string;
  /** What it declares it provides. */
  capabilities?: string[];
}

/** Which plugin owns a capability, and where it was installed from when that is known. */
interface CapabilityOwner {
  /** The owning plugin's id. */
  id: string;
  /** Its clone URL, when this home's plugin list names one. */
  url: string | undefined;
}

const APP_HOME = join(homedir(), ".config", "opencode");
function configDir() { return loaderConfigDir(APP_HOME); }

// opencode.jsonc wins over opencode.json when both exist.
/**
 * This app's own config file: the commented variant when it exists, the plain one otherwise.
 *
 * @returns its absolute path, whether or not it exists yet.
 */
export function opencodeConfigPath(): string {
  return join(configDir(), existsSync(join(configDir(), "opencode.jsonc")) ? "opencode.jsonc" : "opencode.json");
}

// String-aware JSONC comment stripper: removes // line and /* */ block comments
// but never touches // that appears inside a JSON string (e.g. "http://host").
function stripJsonc(text: string): string {
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
function splitCommand(s: string): string[] {
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

function readJsonSafe<T>(path: string, fallback: T): T {
  try { return JSON.parse(stripJsonc(readFileSync(path, "utf8"))); } catch (e) { return fallback; }
}

/**
 * The MCP servers this app has configured, in the shape the terminal's list renders.
 *
 * @returns one row per server, or none when the config is absent or unreadable.
 */
export function mcpServers(): CapabilityMcpServer[] {
  try {
    var cfg = readJsonSafe<OpencodeConfig>(opencodeConfigPath(), {}) || {};
    var mcp = (cfg && typeof cfg.mcp === "object" && cfg.mcp) || {};
    return Object.keys(mcp).map(function (name): CapabilityMcpServer {
      var c: OpencodeMcpEntry = mcp[name] || {};
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
/**
 * Adds one MCP server to this app's own config.
 *
 * @remarks
 * A read-modify-write of a file that may hold the user's whole configuration, so a parse failure
 * ABORTS rather than replacing it with a fresh object. Comments do not survive the rewrite; the data
 * does, which is the repo's convention.
 *
 * @param spec what the add flow collected.
 * @returns whether it was written, and why not when it was not.
 */
export function addMcpServer(spec: McpServerDraft | null): CapabilityResult {
  try {
    var name = spec && spec.name;
    var transport = spec && spec.transport;
    var target = spec && spec.target;
    if (!name) return { ok: false, error: "missing name" };
    if (!target) return { ok: false, error: "missing target" };
    var path = opencodeConfigPath();
    var cfg: OpencodeConfig = {};
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
      cfg.mcp[name] = { type: "remote", url: String(target), enabled: true };
    } else {
      var command = Array.isArray(target) ? target : splitCommand(String(target));
      cfg.mcp[name] = { type: "local", command: command, enabled: true };
    }
    writeFileSync(path, JSON.stringify(cfg, null, 2), "utf8");
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e instanceof Error ? e.message : e) }; }
}

// Which deployed plugin provides a capability, given what a home's manifests declare. A capability
// id is the only key: no plugin is named here, and an id this loader has never heard of answers
// exactly like one it has.
/**
 * Which deployed plugin provides a capability, from what a home's manifests declare.
 *
 * @param manifests every deployed plugin's manifest.
 * @param capabilityId the capability to find an owner for.
 * @param urlFor resolves a plugin's clone URL, when the caller can.
 * @returns the owner, or `null` when nothing declares it.
 */
export function ownerOfCapability(manifests: ManifestLike[] | null | undefined, capabilityId: string, urlFor?: (id: string) => string | undefined): CapabilityOwner | null {
  for (const manifest of manifests || []) {
    const declared = (manifest && manifest.capabilities) || [];
    if (declared.indexOf(capabilityId) === -1) continue;
    return { id: manifest.id, url: urlFor ? urlFor(manifest.id) : undefined };
  }
  return null;
}

function urlFromPluginList(paths: HomePaths, id: string): string | undefined {
  try {
    const listed = JSON.parse(readFileSync(join(paths.configFolder, "plugins.json"), "utf8"));
    const entry = ((listed || []) as Array<{ name?: string; url?: string }>).find((item) => item && item.name === id);
    return entry && typeof entry.url === "string" ? entry.url : undefined;
  } catch {
    return undefined;
  }
}

// The plugin that provides a capability in THIS home, read from the manifest sidecars deploy
// writes beside each bundle. Never throws into the TUI: an unreadable home answers null, which
// every caller already renders as "nothing offers this".
/**
 * The plugin providing a capability in THIS home, read from the manifest sidecars beside each bundle.
 *
 * @param capabilityId the capability to find an owner for.
 * @returns the owner, or `null` when the home is unreadable or nothing declares it.
 */
export function pluginByCapability(capabilityId: string): CapabilityOwner | null {
  try {
    const paths = homePaths(loaderConfigDir(APP_HOME));
    const manifests = readDeployedManifests(paths.pluginDir).loaded.map((entry) => entry.manifest) as ManifestLike[];
    return ownerOfCapability(manifests, capabilityId, (id) => urlFromPluginList(paths, id));
  } catch {
    return null;
  }
}
