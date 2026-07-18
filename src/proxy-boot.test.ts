import { describe, it, expect } from "vitest";
import { resolveProxyToggle } from "./proxy-boot.js";

describe("resolveProxyToggle", () => {
  it("is disabled by default (no config / use_proxy unset)", () => {
    expect(resolveProxyToggle(undefined)).toEqual({ enabled: false, port: 34568 });
    expect(resolveProxyToggle({})).toEqual({ enabled: false, port: 34568 });
  });

  it("stays disabled unless use_proxy is exactly true", () => {
    expect(resolveProxyToggle({ use_proxy: false })).toEqual({ enabled: false, port: 34568 });
    expect(resolveProxyToggle({ use_proxy: "true" })).toEqual({ enabled: false, port: 34568 });
    expect(resolveProxyToggle({ use_proxy: 1 })).toEqual({ enabled: false, port: 34568 });
  });

  it("enables on use_proxy=true, defaulting the port to 34568", () => {
    expect(resolveProxyToggle({ use_proxy: true })).toEqual({ enabled: true, port: 34568 });
  });

  it("honours a valid proxy_port", () => {
    expect(resolveProxyToggle({ use_proxy: true, proxy_port: 40000 })).toEqual({ enabled: true, port: 40000 });
    expect(resolveProxyToggle({ use_proxy: true, proxy_port: "40001" })).toEqual({ enabled: true, port: 40001 });
  });

  it("degrades an invalid proxy_port to the default", () => {
    expect(resolveProxyToggle({ use_proxy: true, proxy_port: "nonsense" })).toEqual({ enabled: true, port: 34568 });
    expect(resolveProxyToggle({ use_proxy: true, proxy_port: 0 })).toEqual({ enabled: true, port: 34568 });
  });
});
