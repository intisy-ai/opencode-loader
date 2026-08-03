// The OpenCode app<->IR front-door, owned by the app layer. Deployed to dist/frontdoor.js and
// published so core-auth (in each provider) resolves it at runtime. Names OpenCode legitimately:
// this is the app layer.
import { serveDirect } from "../opencode-proxy/dist/index.js";

function authMethods(def: any, tk: any) {
  if (typeof def.loginFlow !== "function") return [{ label: def.label + " (via core-auth)", type: "api" }];
  return [{
    type: "oauth", label: def.label,
    authorize: async function () {
      if (def.accounts && tk.isTTY()) {
        try { await tk.runProviderMenu(def); } catch (e) { tk.log("account menu failed: " + e); }
        await tk.refreshModels(def, true);
        return { url: "", instructions: def.label + " accounts updated.", method: "auto", callback: async () => ({ type: "success", refresh: "core-auth", access: "", expires: 0 }) };
      }
      const flow = await def.loginFlow({ configDir: tk.configDir, log: tk.log });
      return {
        url: flow.url,
        instructions: flow.instructions || ("Sign in to " + def.label + ", then paste the authorization code (or the full redirect URL) here."),
        method: "code",
        callback: async function (code: string) {
          try {
            const account = await flow.complete(code);
            if (!account || !account.refresh) return { type: "failed" };
            await tk.refreshModels(def, true);
            return { type: "success", refresh: account.refresh, access: account.access || "", expires: account.expires || 0 };
          } catch (error) { tk.log("oauth login failed: " + error); return { type: "failed" }; }
        },
      };
    },
  }];
}

export const appFrontDoor = {
  serve(request: Request, handleIr: any, ctx: any): Promise<Response> { return serveDirect(request, handleIr, ctx); },
  buildPluginHooks(def: any, input: any, tk: any) {
    const appProviderId = def.appProviderId || def.id;
    try { tk.setAppClient(input && input.client); } catch { /* best-effort */ }
    try {
      const client = input && input.client;
      if (client && client.auth && tk.listAccounts(def.id).length > 0) {
        client.auth.set({ path: { id: appProviderId }, body: { type: "oauth", refresh: "", access: "", expires: 0 } });
      }
    } catch (e) { tk.log("auto-route seed failed: " + e); }
    const hooks: any = {
      auth: {
        provider: appProviderId,
        methods: authMethods(def, tk),
        loader: async function () {
          return { apiKey: def.id, fetch: (req: any, init: any) => tk.dispatchFetch(def, new Request(req, init), process.env, { configDir: tk.configDir, log: tk.log }) };
        },
      },
    };
    if (typeof def.appHooks === "function") {
      try { Object.assign(hooks, def.appHooks(input) || {}); } catch (e) { tk.log("appHooks failed: " + e); }
    }
    return hooks;
  },
};
