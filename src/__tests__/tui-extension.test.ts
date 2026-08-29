// The extension's registration side, against an isolated temp HUB_CONFIG_DIR, never the real
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

// A provider asks its context for this and never imports core-auth, so a loader that stopped
// registering it would leave every provider unable to provide the capability it declared.
test("the extension offers basekit/auth's provider helpers as a host service", async () => {
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
