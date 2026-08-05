#!/usr/bin/env node
// @ts-nocheck
// Opt-in OpenCode proxy daemon (parity with the claude-code-loader proxy). By
// DEFAULT OpenCode routes in-process (core-auth loader.fetch -> handle()), so
// this daemon stays dormant; it is only started when opencode-loader config
// use_proxy=true (see proxy-boot.ts). The generic daemon scaffolding (config-dir
// logging, start-marker, dynamic provider resolver, listen) lives in
// core-loader's startLoaderProxy; this entry only supplies the OpenCode
// specifics: opencodeProfile + createProxyServer/makeDynamicResolver from
// opencode-proxy and the :34568 default port.
import { join } from "path";
import { homedir } from "os";
import { startLoaderProxy } from "../core-loader/dist/proxy-runner.js";
import { createProxyServer, opencodeProfile, makeDynamicResolver } from "../opencode-proxy/dist/index.js";
import { emitEvent, setActivityContext } from "../core/dist/index.js";

const PORT = parseInt(process.env.HUB_PROXY_PORT || "34568", 10);
const CONFIG_DIR = process.env.HUB_CONFIG_DIR || join(homedir(), ".config", "opencode");

// This process is the proxy daemon and nothing else, so naming the entry once is
// accurate for every event it emits, including core-proxy's per-request ones.
setActivityContext({ entry: "proxy" });

startLoaderProxy({
  createProxyServer,
  makeDynamicResolver,
  profile: opencodeProfile(),
  configDir: CONFIG_DIR,
  port: PORT,
  emitActivity: (spec) => emitEvent(spec, "core-proxy"),
});
