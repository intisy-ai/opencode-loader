// Bundle the loader's plugin entry into ONE self-contained ESM file. OpenCode
// auto-loads each deployed plugin/<name>.js, and the updater imports it under
// Claude, both loading that single file in isolation, so sibling modules
// (commands.ts) and core/dist must be INLINED (a plain tsc build leaves an
// unresolvable `./commands.js` import from the deploy dir). esbuild inlines
// it all. (The TUI is a separate process, core-loader/dist/tui.js, and stays
// external.)
import { build } from "esbuild";

const banner = {
  js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);",
};

// tui-extension.ts is loaded in isolation via HUB_TUI_EXTENSION from the repo's
// dist dir; it imports core-loader's shared account-menu, so it must be bundled
// self-contained too (a plain tsc build leaves an unresolvable
// ../core-loader/dist import). proxy.ts is the opt-in proxy daemon (run
// standalone via `node dist/proxy.js`); it imports core-loader's
// startLoaderProxy + opencode-proxy's routing engine, so it must be bundled
// to stay a single self-contained file with no runtime cross-submodule
// dependency. (proxy-boot.ts stays inlined into dist/plugin.js via
// plugin.ts's import; it only runs in-process during activate().)
await build({
  entryPoints: ["src/plugin.ts", "src/tui-extension.ts", "src/proxy.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outdir: "dist",
  banner,
  logLevel: "info",
});

console.log("Bundled loader plugin -> dist/plugin.js, dist/tui-extension.js, dist/proxy.js");
