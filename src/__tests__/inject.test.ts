import { describe, it, expect } from "vitest";
import { frontDoorModulePath, wrapperEnvLines } from "../inject.js";

describe("front-door injection wiring", () => {
  it("computes the deployed front-door module path under the home", () => {
    expect(frontDoorModulePath("/home/.config/opencode")).toContain("repos/opencode-loader/dist/frontdoor.js");
  });
  it("emits a wrapper env line exporting HUB_APP_FRONTDOOR", () => {
    const lines = wrapperEnvLines("/home/.config/opencode", "sh");
    expect(lines.some(l => l.includes("HUB_APP_FRONTDOOR"))).toBe(true);
  });
});
