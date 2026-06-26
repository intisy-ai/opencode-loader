// Universal plugin contract via core's shared test-kit. The loader is app-specific
// (opencode only) and deploys its commands in activate() via deployLoaderCommands,
// so the kit calls that export rather than a bare load.
import { runPluginContract } from "../../core/src/testing.js";

runPluginContract({
  name: "opencode-loader",
  entry: "dist/plugin.js",
  configName: "opencode-loader",
  app: "opencode",
  commands: ["opencode-loader-config", "plugins", "accounts"],
  deploy: { module: "dist/commands.js", fn: "deployLoaderCommands", arg: "opencode" },
  actions: [["plugins"], ["accounts"]],
});
