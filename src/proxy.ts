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
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { startLoaderProxy } from "../core-loader/dist/proxy-runner.js";
import { createProxyServer, opencodeProfile, makeDynamicResolver } from "../opencode-proxy/dist/index.js";

const PORT = parseInt(process.env.HUB_PROXY_PORT || "34568", 10);
const CONFIG_DIR = process.env.HUB_CONFIG_DIR
  || (existsSync(join(homedir(), ".config", "opencode")) ? join(homedir(), ".config", "opencode") : join(homedir(), ".claude"));

startLoaderProxy({ createProxyServer, makeDynamicResolver, profile: opencodeProfile(), configDir: CONFIG_DIR, port: PORT });
