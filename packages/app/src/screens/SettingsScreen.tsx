import { MemorizeSettingsPage } from "@spudly/ui";

/**
 * Settings tab host (#101): at @spudly/ui 6.0.0 the DS
 * MemorizeSettingsPage renders no API-key section and takes no
 * key props (DS #439) — bring-your-own-key ended on native too
 * (web search is server-key-only by design; native search uses
 * the offline demo set), so the host has no state or store
 * wiring left to pass. Store readiness is gated in App, above
 * this screen, so there is no loading state here.
 */
export default function SettingsScreen() {
  return <MemorizeSettingsPage />;
}
