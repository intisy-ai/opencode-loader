// Covers the capability lookup the Providers tab uses to find the plugin that
// serves user-defined endpoints, read from deployed manifest sidecars rather
// than a hardcoded plugin table.
import { describe, it, expect } from "vitest";
import { ownerOfCapability } from "../opencode-caps.js";

describe("ownerOfCapability", () => {
  const manifests = [
    { id: "plain", api: 1 },
    { id: "endpoints", api: 1, capabilities: ["custom-endpoints", "screens"] },
    { id: "second", api: 1, capabilities: ["custom-endpoints"] },
  ];

  it("answers with the plugin that declares the capability", () => {
    expect(ownerOfCapability(manifests, "custom-endpoints")).toEqual({ id: "endpoints", url: undefined });
  });

  it("answers null when nothing declares it, which is what makes the row disappear", () => {
    expect(ownerOfCapability(manifests, "time-travel")).toBeNull();
  });

  it("ignores a manifest that declares no capabilities at all", () => {
    expect(ownerOfCapability([{ id: "plain", api: 1 }], "custom-endpoints")).toBeNull();
  });

  it("carries the url the home has for it, so an absent clone can still be installed", () => {
    expect(ownerOfCapability(manifests, "custom-endpoints", (id) => `https://github.com/intisy-ai/${id}`))
      .toEqual({ id: "endpoints", url: "https://github.com/intisy-ai/endpoints" });
  });

  it("takes the first declarer, in the order the home reported them", () => {
    expect(ownerOfCapability(manifests, "custom-endpoints")?.id).toBe("endpoints");
  });
});
