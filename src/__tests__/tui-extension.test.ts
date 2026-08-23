// The host builds every plugin's context from this runtime. core-loader carries no core submodule
// and starts no host at all when nothing is injected, so a loader that stops registering it leaves
// every plugin screen and setting silently empty. Isolated temp HUB_CONFIG_DIR, never the real
// ~/.config/opencode.
import { test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import tuiExtension from "../tui-extension.js";

let homeDir;
let prevConfigDir;

beforeEach(() => {
  homeDir = mkdtempSync(join(tmpdir(), "opencode-loader-tui-extension-"));
  prevConfigDir = process.env.HUB_CONFIG_DIR;
  process.env.HUB_CONFIG_DIR = homeDir;
});

afterEach(() => {
  if (prevConfigDir === undefined) delete process.env.HUB_CONFIG_DIR;
  else process.env.HUB_CONFIG_DIR = prevConfigDir;
  rmSync(homeDir, { recursive: true, force: true });
});

test("the extension registers a runtime the plugin host can build a context from", async () => {
  const registered = {};
  const tuiApi = {
    registerTab: () => {},
    registerCapabilities: (caps) => Object.assign(registered, caps),
  };

  await tuiExtension(tuiApi);

  expect(typeof registered.runtimeFor).toBe("function");
  const runtime = registered.runtimeFor({ id: "demo", api: 1 });
  expect(typeof runtime.config.all).toBe("function");
  expect(typeof runtime.log.info).toBe("function");
  expect(typeof runtime.paths.home).toBe("string");
  expect(typeof runtime.events.publish).toBe("function");
});

// core mints these ids and core-loader takes no core submodule, so they reach the plugin host only
// if this loader passes them. Without them the host cannot tell an unrecognised capability from an
// unverifiable one, and a plugin's typo goes unreported.
test("the extension registers the capability vocabulary from the library that mints it", async () => {
  const registered = {};
  const tuiApi = {
    registerTab: () => {},
    registerCapabilities: (caps) => Object.assign(registered, caps),
  };

  await tuiExtension(tuiApi);

  expect(registered.vocabulary.map((entry) => entry.id).sort())
    .toEqual(["custom-endpoints", "plugin-management", "screens", "settings"]);
  expect(registered.wellKnownServices.map((entry) => entry.id).sort())
    .toEqual(["accounts", "activity", "routing"]);
});

// A provider asks its context for this and never imports core-auth, so a loader that stopped
// registering it would leave every provider unable to provide the capability it declared.
test("the extension offers core-auth's provider helpers as a host service", async () => {
  const registered = {};
  const tuiApi = {
    registerTab: () => {},
    registerCapabilities: (caps) => Object.assign(registered, caps),
  };

  await tuiExtension(tuiApi);

  const support = registered.services.find((service) => service.id === "provider-support");
  expect(support).toBeDefined();
  const capability = support.implementation.capability({ id: "stub", label: "Stub", models: {}, handleIr: async () => ({}) });
  expect(capability.id).toBe("stub");
  expect(typeof support.implementation.printAccounts).toBe("function");
});
