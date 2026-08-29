// Opt-in proxy activation. When opencode-loader config use_proxy=true, activate()
// (which runs INSIDE the OpenCode process, the same process where basekit/auth's
// loader.fetch later runs) marks the env so that fetch forwards to a local
// opencode-proxy daemon, and ensures that daemon is running. When use_proxy is
// false (the DEFAULT) this is a pure no-op and OpenCode keeps routing in-process.
import { existsSync } from "fs";
import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createConnection } from "net";

const DEFAULT_PROXY_PORT = 34568;

/** The proxy knobs this loader reads out of its own config. */
interface ProxyConfig {
  /** Whether the daemon is used at all. Absent or false keeps routing in-process. */
  use_proxy?: boolean;
  /** Which port it listens on, defaulting when it is missing or not a positive number. */
  proxy_port?: number | string;
}

/** Whether the opt-in proxy is on, and where. */
interface ProxyToggle {
  /** Whether it is enabled. */
  enabled: boolean;
  /** The port it uses. */
  port: number;
}

/** The resolved state after an activation pass, including whether this pass started the daemon. */
interface ProxyState extends ProxyToggle {
  /** Whether this call spawned it, as opposed to finding it already listening. */
  started: boolean;
}

// Pure decision: is the opt-in proxy enabled, and on which port? Kept separate so
// it is unit-testable without spawning anything. A misconfigured (non-numeric or
// non-positive) proxy_port degrades to the default rather than producing NaN.
/**
 * Whether the opt-in proxy is enabled, and on which port.
 *
 * @remarks
 * Kept pure and separate so it is testable without spawning anything. A non-numeric or
 * non-positive port degrades to the default rather than producing a NaN nothing can bind.
 *
 * @param config this loader's own config.
 * @returns the resolved toggle.
 */
export function resolveProxyToggle(config: ProxyConfig | null | undefined): ProxyToggle {
  const enabled = !!(config && config.use_proxy === true);
  const parsed = parseInt(String((config && config.proxy_port) || DEFAULT_PROXY_PORT), 10);
  const port = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PROXY_PORT;
  return { enabled, port };
}

// Resolves true if something is already listening on 127.0.0.1:<port> (an
// existing daemon from a previous `oc` launch), so we never spawn a duplicate.
function isListening(port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    let timer: ReturnType<typeof setTimeout>;
    const done = (result: boolean) => { clearTimeout(timer); try { socket.destroy(); } catch {} resolve(result); };
    socket.on("connect", () => done(true));
    socket.on("error", () => done(false));
    timer = setTimeout(() => done(false), 500);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// Turns on same-process proxy routing: basekit/auth's loader.fetch (same process)
// reads these per request, so setting them makes it forward to the daemon. Only
// called once a daemon is actually listening or has just been spawned, never
// while there is nothing behind the port (that would break every request).
function markProxyEnv(port: number): void {
  process.env.HUB_OC_PROXY = "1";
  process.env.HUB_PROXY_PORT = String(port);
}

// Applies the opt-in proxy toggle. Returns the resolved state; never throws (a
// proxy setup failure must not break OpenCode startup, it just degrades to
// in-process routing, which is the default anyway).
/**
 * Applies the opt-in proxy toggle: routes through a daemon, starting one if needed.
 *
 * @remarks
 * Never throws. A proxy that cannot be started degrades to in-process routing, which is the
 * default anyway, and the env is only marked once something is actually listening: marking it
 * with nothing behind the port would break every request for the whole session.
 *
 * @param config this loader's own config.
 * @param log where to record what happened.
 * @returns the resolved state.
 */
export async function ensureProxy(config: ProxyConfig | null | undefined, log: (message: string) => void): Promise<ProxyState> {
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
