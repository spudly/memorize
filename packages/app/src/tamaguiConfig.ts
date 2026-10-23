import { createTamaguiConfig, memorizeTheme } from "@spudly/ui";

/**
 * The app's Tamagui config — created by the app itself via the
 * design system's factory, NOT imported prebuilt from @spudly/ui
 * (the prebuilt `tamaguiConfig` export was removed in @spudly/ui
 * 1.x; this file is the 1.4.0 bump's replacement for it).
 *
 * Why: Tamagui v3 resolves every theme/token against a single
 * global config — the one most recently passed to
 * `createTamagui()` — and `TamaguiProvider`'s `config` prop does
 * not install its config for style resolution (it only seeds the
 * default theme name and the animation driver). @spudly/ui used to
 * create several configs at module scope (base, Eciperay, Memorize,
 * Storybook), so the last one evaluated won globally: importing a
 * prebuilt config left another brand's config in charge of the app
 * (spudly/eciperay#149).
 *
 * This module evaluates after the @spudly/ui module, so the config
 * created here is the last `createTamagui()` call and the one the
 * runtime actually resolves against. Keep it that way: exactly one
 * config creation per app entry, in app-owned code.
 */
export const appTamaguiConfig = createTamaguiConfig(memorizeTheme);
