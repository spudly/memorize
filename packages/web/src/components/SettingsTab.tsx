import { MemorizeSettingsPage } from "@spudly/ui";

/**
 * Settings tab host (#101): at @spudly/ui 6.0.0 the DS
 * MemorizeSettingsPage renders no API-key section and takes no
 * key props (DS #439) — Memorize search is server-key-only on web
 * and there is no user key on any platform, so the host has no
 * state or store wiring left to pass.
 */
export default function SettingsTab() {
  return <MemorizeSettingsPage />;
}
