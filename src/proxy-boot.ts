// @ts-nocheck
// Opt-in proxy activation. When opencode-loader config use_proxy=true, activate()
// (which runs INSIDE the OpenCode process, the same process where core-auth's
// loader.fetch later runs) marks the env so that fetch forwards to a local
// opencode-proxy daemon, and ensures that daemon is running. When use_proxy is
// false (the DEFAULT) this is a pure no-op and OpenCode keeps routing in-process.
import { existsSync } from "fs";
import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createConnection } from "net";

const DEFAULT_PROXY_PORT = 34568;

// Pure decision: is the opt-in proxy enabled, and on which port? Kept separate so
// it is unit-testable without spawning anything. A misconfigured (non-numeric or
// non-positive) proxy_port degrades to the default rather than producing NaN.
export function resolveProxyToggle(config) {
  const enabled = !!(config && config.use_proxy === true);
  const parsed = parseInt((config && config.proxy_port) || DEFAULT_PROXY_PORT, 10);
  const port = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PROXY_PORT;
  return { enabled, port };
}

// Resolves true if something is already listening on 127.0.0.1:<port> (an
// existing daemon from a previous `oc` launch), so we never spawn a duplicate.
function isListening(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    let timer;
    const done = (result) => { clearTimeout(timer); try { socket.destroy(); } catch {} resolve(result); };
    socket.on("connect", () => done(true));
    socket.on("error", () => done(false));
    timer = setTimeout(() => done(false), 500);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Turns on same-process proxy routing: core-auth's loader.fetch (same process)
// reads these per request, so setting them makes it forward to the daemon. Only
// called once a daemon is actually listening or has just been spawned, never
// while there is nothing behind the port (that would break every request).
function markProxyEnv(port) {
  process.env.HUB_OC_PROXY = "1";
  process.env.HUB_PROXY_PORT = String(port);
}

// Applies the opt-in proxy toggle. Returns the resolved state; never throws (a
// proxy setup failure must not break OpenCode startup, it just degrades to
// in-process routing, which is the default anyway).
export async function ensureProxy(config, log) {
  const { enabled, port } = resolveProxyToggle(config);
  if (!enabled) return { enabled: false, port, started: false };

  if (await isListening(port)) {
    markProxyEnv(port);
    log("opencode proxy daemon already listening on 127.0.0.1:" + port);
    return { enabled: true, port, started: false };
  }

  const proxyScript = join(dirname(fileURLToPath(import.meta.url)), "proxy.js");
  if (!existsSync(proxyScript)) {
    // No daemon to run: stay in-process rather than enabling routing to a dead
    // port, which would silently break every request for the whole session.
    log("opencode proxy daemon script not found at " + proxyScript + "; staying in-process");
    return { enabled: false, port, started: false };
  }

  const child = spawn(process.execPath, [proxyScript], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, HUB_PROXY_PORT: String(port) },
  });
  // A spawn failure (EACCES/EPERM/AV) surfaces asynchronously via 'error'; with no
  // listener Node throws and crashes the whole OpenCode process, so swallow it.
  child.on("error", (e) => log("opencode proxy daemon spawn error: " + e));
  child.unref();
  markProxyEnv(port);
  log("started opencode proxy daemon on 127.0.0.1:" + port);
  // Brief bounded readiness wait so the first request doesn't race the bind.
  for (let i = 0; i < 15; i++) {
    if (await isListening(port)) break;
    await sleep(100);
  }
  return { enabled: true, port, started: true };
}
