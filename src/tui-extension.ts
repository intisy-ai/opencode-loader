// Loader-owned "Providers" tab (HUB_TUI_EXTENSION). Generic + thin: discovers
// providers from each plugin's package.json claudeHub declaration, and on Enter
// opens that provider's account/quota menu in-tab. The menu rendering + all its
// navigation live in core-loader's shared account-menu (also used by the Claude
// loader); the menu MODEL lives in core-auth. This file only lists providers.
import { pathToFileURL } from "url";
import type { AccountMenuApi } from "@intisy-ai/core-loader/dist/account-menu.js";
import type { CustomProviderEngine, CustomEndpointDraft } from "@intisy-ai/core-loader/dist/custom-provider.js";
import type { CustomTabContext, CustomTabRenderContext, CustomTabUi } from "@intisy-ai/core-loader/dist/custom-tab.js";
import type { TuiApi } from "@intisy-ai/core-loader/dist/tui.js";

/** The endpoint API a deployed custom-provider plugin exposes, loaded from its own handler. */
interface EndpointsApi {
  /** The plugin's verdict on a draft endpoint, empty when it would work. */
  validateEndpoint: (endpoint: CustomEndpointDraft) => string | Promise<string | undefined> | undefined;
  /** Stores one endpoint in the plugin's own clone. */
  upsertEndpoint: (endpoint: CustomEndpointDraft, cloneDir: string) => void;
  /** Stores that endpoint's key. */
  saveKey: (id: string, key: string) => void;
}
import { join } from "path";
import { homedir } from "os";
import { createAccountMenu } from "@intisy-ai/core-loader/dist/account-menu.js";
import { providerRows } from "@intisy-ai/core-loader/dist/provider-catalog.js";
import { loaderConfigDir, loaderReposDir } from "@intisy-ai/core-loader/dist/app-home.js";
import { extraProviderRows } from "@intisy-ai/core-loader/dist/provider-rows.js";
import { getUpdater, setupPlugin } from "@intisy-ai/core-loader/dist/updater.js";
import { readActivity, createActivitySeam, setActivityContext, globalSettingsSchema } from "@intisy-ai/core";
import type { ActivityQuery } from "@intisy-ai/core";
import { PROVIDER_SUPPORT, providerSupport } from "@intisy-ai/core-auth";
import * as caps from "./opencode-caps.js";

const APP_HOME = join(homedir(), ".config", "opencode");
function configDir() { return loaderConfigDir(APP_HOME); }
function reposDir() { return loaderReposDir(APP_HOME); }
// Which providers exist here and how many models each serves comes from core-loader, so this
// loader and the Claude one cannot report different numbers for the same home.
function providers() {
  return providerRows(reposDir(), configDir());
}

var tab = { cur: 0 };
var menu = createAccountMenu();

// The view's own rows, from core-loader so every loader shows the same ones. Everything they
// need that lives in core or in this loader is passed in.
// The deployed plugin's endpoint API, loaded once.
var endpointsApiCache: EndpointsApi | null = null;
async function endpointsApi(engine: CustomProviderEngine): Promise<EndpointsApi> {
  if (!endpointsApiCache) {
    var handler = join(reposDir(), engine.id, "dist", "handler.js");
    endpointsApiCache = (await import(pathToFileURL(handler).href)) as EndpointsApi;
  }
  return endpointsApiCache;
}

function ownRows() {
  return extraProviderRows({
    reposDir: reposDir(),
    pluginByCapability: caps.pluginByCapability,
    // The plugin owns what an endpoint is, whether one would work, and how it becomes
    // routable, so it is asked for all three rather than any of it living here.
    validate: async function (engine, endpoint) {
      return (await endpointsApi(engine)).validateEndpoint(endpoint);
    },
    addEndpoint: async function (engine, endpoint, key) {
      var api = await endpointsApi(engine);
      api.upsertEndpoint(endpoint, join(reposDir(), engine.id));
      if (key && endpoint.id) api.saveKey(endpoint.id, key);
    },
    hasManager: function () { return !!getUpdater(); },
    openAction: function (action, tuiApi: AccountMenuApi, title: string) { menu.openAction(action, tuiApi, title); },
    install: function (engine: CustomProviderEngine, tuiApi: AccountMenuApi) {
      tuiApi.flash?.("Installing " + engine.id + "…");
      setupPlugin({ name: engine.id, url: engine.url }, function (err: string) {
        tuiApi.flash?.(err ? "Install failed: " + err : engine.id + " installed");
        tuiApi.refresh?.();
      });
    },
  });
}

function render(state: CustomTabRenderContext, h: CustomTabUi): void {
  if (menu.render(h)) return;
  var ps = providers();
  var rows = ownRows();
  h.pushBody("  " + h.BOLD + h.WHITE + "Providers" + h.RST + h.GRAY + " (" + ps.length + ")" + h.RST, false);
  h.pushBody("", false);
  if (!ps.length) h.pushBody("    " + h.DIM + "No providers installed." + h.RST, false);
  ps.forEach(function (p, i) {
    var sel = tab.cur === i; var c = p.count;
    h.pushBody("  " + (sel ? h.ACCENT + "❯ " + h.RST : "  ") + (sel ? h.BG_SEL + h.BOLD + h.WHITE : h.GRAY) + p.id + h.RST + h.DIM + "  " + (c ? c + " models" : "no models yet") + h.RST, sel);
  });
  if (rows.length) {
    h.pushBody("", false);
    rows.forEach(function (r, i) {
      var sel = tab.cur === ps.length + i;
      h.pushBody("  " + (sel ? h.ACCENT + "❯ " + h.RST : "  ") + (sel ? h.BG_SEL + h.BOLD + h.WHITE : h.ACCENT) + r.label + h.RST + h.DIM + "  " + r.hint + h.RST, sel);
    });
  }
  h.pushFoot("  " + h.GRAY + "─".repeat(h.barW) + h.RST);
  h.pushFoot("  " + h.DIM + "^v Move   Enter Configure (accounts + Auto)   Tab Switch   Q Quit" + h.RST);
}

function handleKey(key: string | null, state: CustomTabContext, tuiApi: TuiApi): void {
  if (menu.handleKey(key, tuiApi)) return;
  var ps = providers();
  var rows = ownRows();
  var total = ps.length + rows.length;
  if (!total) return;
  if (key === "up" || key === "w") { tab.cur = (tab.cur - 1 + total) % total; return; }
  if (key === "down" || key === "s") { tab.cur = (tab.cur + 1) % total; return; }
  if (key === "enter" || key === "space") {
    if (tab.cur < ps.length) { const handler = ps[tab.cur].handler; if (handler) menu.open(handler, tuiApi, ps[tab.cur].id); return; }
    rows[tab.cur - ps.length].run(tuiApi);
    return;
  }
}

/** Registers this loader's Providers tab and everything this app can do, at TUI startup. */
export default function (tuiApi: TuiApi): void {
  tuiApi.registerTab({ id: "providers", label: "Providers", render: render, handleKey: handleKey });
  setActivityContext({ entry: "tui" });
  // Register ONLY opencode's MCP-server capability (see src/opencode-caps.ts):
  // opencode has its own session UI and no plugin marketplace, so
  // listSessions/foreignPlugins/marketplaces stay unregistered here (their
  // core-loader UI sections are then simply absent under this loader).
  // Guarded: core-loader resolves from a version range, so an older one may not carry it yet.
  if (typeof tuiApi.registerCapabilities === "function") {
    tuiApi.registerCapabilities({
      mcpServers: caps.mcpServers,
      addMcpServer: caps.addMcpServer,
      // Behaviour a plugin may not link for itself: core-auth's provider helpers, which core-loader
      // may not link either, being in the same layer. Linked once here rather than copied into every
      // provider bundle.
      services: [{ id: PROVIDER_SUPPORT, implementation: providerSupport() }],
      activity: {
        read: (query?: ActivityQuery) => { try { return readActivity([configDir()], { limit: 200, ...(query || {}) }).records; } catch { return []; } },
        ...createActivitySeam("opencode-loader"),
      },
      // core owns the shared settings declaration; the menu renders whatever it says
      globalSettings: (() => { try { return globalSettingsSchema(); } catch { return undefined; } })(),
    });
  }
}
