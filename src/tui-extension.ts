// @ts-nocheck
// Loader-owned "Providers" tab (HUB_TUI_EXTENSION). Generic + thin: discovers
// providers from each plugin's package.json claudeHub declaration, and on Enter
// opens that provider's account/quota menu in-tab. The menu rendering + all its
// navigation live in core-loader's shared account-menu (also used by the Claude
// loader); the menu MODEL lives in core-auth. This file only lists providers.
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { createAccountMenu } from "../core-loader/dist/account-menu.js";
import * as caps from "./opencode-caps.js";

function configDir() { return process.env.HUB_CONFIG_DIR || join(homedir(), ".config", "opencode"); }
function reposDir() { return join(configDir(), "repos"); }
function readJSON(p, fallback) { try { return JSON.parse(readFileSync(p, "utf8")); } catch (e) { return fallback; } }
function modelsCache() { const d = join(configDir(), "config"); return readJSON(join(d, "models.json"), null) || readJSON(join(d, "core-auth-models.json"), {}); }
function opencodeConfigPath() { return join(configDir(), existsSync(join(configDir(), "opencode.jsonc")) ? "opencode.jsonc" : "opencode.json"); }
function modelCount(pid) { var c = readJSON(opencodeConfigPath(), {}); return Object.keys((c.provider && c.provider[pid] && c.provider[pid].models) || {}).length; }

function providers() {
  var out = [], seen = {}, repos = [];
  try { repos = readdirSync(reposDir()); } catch (e) {}
  for (var i = 0; i < repos.length; i++) {
    var pkg = readJSON(join(reposDir(), repos[i], "package.json"), null);
    var declared = (pkg && pkg.claudeHub && pkg.claudeHub.authProviders) || (pkg && pkg.authProviders) || [];
    for (var j = 0; j < declared.length; j++) {
      var id = declared[j] && (declared[j].name || repos[i]);
      if (!id || seen[id]) continue; seen[id] = 1;
      out.push({ id: id, handler: declared[j].handler ? join(reposDir(), repos[i], declared[j].handler) : null });
    }
  }
  for (var k of Object.keys(modelsCache())) if (!seen[k]) { seen[k] = 1; out.push({ id: k, handler: null }); }
  return out;
}

var tab = { cur: 0 };
var menu = createAccountMenu();

function render(state, h) {
  if (menu.render(h)) return;
  var ps = providers();
  h.pushBody("  " + h.BOLD + h.WHITE + "Providers" + h.RST + h.GRAY + " (" + ps.length + ")" + h.RST, false);
  h.pushBody("", false);
  if (!ps.length) h.pushBody("    " + h.DIM + "No providers installed." + h.RST, false);
  ps.forEach(function (p, i) {
    var sel = tab.cur === i; var c = modelCount(p.id);
    h.pushBody("  " + (sel ? h.ACCENT + "❯ " + h.RST : "  ") + (sel ? h.BG_SEL + h.BOLD + h.WHITE : h.GRAY) + p.id + h.RST + h.DIM + "  " + (c ? c + " models" : "no models yet") + h.RST, sel);
  });
  h.pushFoot("  " + h.GRAY + "─".repeat(h.barW) + h.RST);
  h.pushFoot("  " + h.DIM + "^v Move   Enter Configure (accounts + Auto)   Tab Switch   Q Quit" + h.RST);
}

function handleKey(key, state, tuiApi) {
  if (menu.handleKey(key, tuiApi)) return;
  var ps = providers();
  if (!ps.length) return;
  if (key === "up" || key === "w") { tab.cur = (tab.cur - 1 + ps.length) % ps.length; return; }
  if (key === "down" || key === "s") { tab.cur = (tab.cur + 1) % ps.length; return; }
  if (key === "enter" || key === "space") { menu.open(ps[tab.cur].handler, tuiApi, ps[tab.cur].id); return; }
}

export default function (tuiApi) {
  tuiApi.registerTab({ id: "providers", label: "Providers", render: render, handleKey: handleKey });
  // Register ONLY opencode's MCP-server capability (see src/opencode-caps.ts) —
  // opencode has its own session UI and no plugin marketplace, so
  // listSessions/foreignPlugins/marketplaces stay unregistered here (their
  // core-loader UI sections are then simply absent under this loader).
  // Guarded: an older/unbumped core-loader submodule may not carry registerCapabilities yet.
  if (typeof tuiApi.registerCapabilities === "function") {
    tuiApi.registerCapabilities({ mcpServers: caps.mcpServers, addMcpServer: caps.addMcpServer });
  }
}
