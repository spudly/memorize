import { readFileSync } from "node:fs";
import { join } from "node:path";

// Source-scan pins for the app's Tamagui config (the DS pages' own
// test pattern): the config itself pulls in the React Native /
// Tamagui runtime, which this node-env harness does not load, so
// the wiring is pinned at the source level instead.
const configSource = readFileSync(join(__dirname, "..", "src", "tamaguiConfig.ts"), "utf8");
const appSource = readFileSync(join(__dirname, "..", "src", "App.tsx"), "utf8");

describe("app Tamagui config", () => {
  it("is created from memorizeTheme (Quiet Dawn), not baseTheme", () => {
    expect(configSource).toContain("createTamaguiConfig(memorizeTheme)");
    expect(configSource).not.toContain("baseTheme");
  });

  it("is exported as appTamaguiConfig from src/tamaguiConfig.ts", () => {
    expect(configSource).toContain("export const appTamaguiConfig");
  });

  it("is the config App.tsx hands to TamaguiProvider", () => {
    expect(appSource).toContain('import { appTamaguiConfig } from "./tamaguiConfig";');
    expect(appSource).toContain("config={appTamaguiConfig}");
  });

  it("is created exactly once — App.tsx creates no config of its own", () => {
    expect(appSource).not.toContain("createTamaguiConfig");
    expect(appSource).not.toContain("baseTheme");
  });
});
