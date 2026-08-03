// Built with forward slashes (not path.join) so the value is stable across platforms:
// it is embedded verbatim into both the sh and cmd wrapper env lines, and must match
// core-auth's resolveAppFrontDoor fallback path (libs/core-auth/src/frontdoor.ts).
export function frontDoorModulePath(configDir: string): string {
  return configDir + "/repos/opencode-loader/dist/frontdoor.js";
}

export function wrapperEnvLines(configDir: string, shell: "sh" | "cmd"): string[] {
  const p = frontDoorModulePath(configDir);
  return shell === "cmd" ? [`set "HUB_APP_FRONTDOOR=${p}"`] : [`export HUB_APP_FRONTDOOR="${p}"`];
}
