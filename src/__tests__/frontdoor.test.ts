import { describe, it, expect } from "vitest";
import { appFrontDoor } from "../frontdoor.js";

const def: any = { id: "stub", label: "Stub", loginFlow: undefined, accounts: undefined };
const toolkit: any = {
  refreshModels: async () => {}, listAccounts: () => [], runProviderMenu: async () => {},
  dispatchFetch: async () => new Response("via-dispatch"), setAppClient: () => {}, isTTY: () => false,
  configDir: "/tmp", log: () => {},
};

describe("opencode appFrontDoor", () => {
  it("builds an OpenCode-shaped auth hook object", async () => {
    const hooks = appFrontDoor.buildPluginHooks(def, { client: null }, toolkit);
    expect(hooks.auth).toBeTruthy();
    expect(hooks.auth.provider).toBe("stub");
    const loaded = await hooks.auth.loader();
    const res = await loaded.fetch(new Request("http://x/v1/messages"));
    expect(await res.text()).toBe("via-dispatch"); // fetch routes through toolkit.dispatchFetch
  });

  it("exposes serve", () => { expect(typeof appFrontDoor.serve).toBe("function"); });
});
