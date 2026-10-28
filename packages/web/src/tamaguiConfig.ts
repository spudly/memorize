import { createTamaguiConfig, memorizeTheme } from "@spudly/ui";

/**
 * The web app's Tamagui config — created by the app itself via the
 * design system's factory, NOT imported prebuilt from @spudly/ui.
 *
 * Why: Tamagui v3 resolves every theme/token against a single
 * global config — the one most recently passed to
 * `createTamagui()` — and `TamaguiProvider`'s `config` prop does
 * not install its config for style resolution. @spudly/ui no longer
 * exports a prebuilt config (the removed `tamaguiConfig` /
 * `memorizeTamaguiConfig`); the package creates several configs
 * at module scope, so the last one evaluated would win globally
 * and apps rendered the wrong brand (spudly/eciperay#149).
 *
 * This module evaluates after the @spudly/ui module, so the
 * config created here is the last `createTamagui()` call and the
 * one the runtime actually resolves against. Keep it that way:
 * exactly one config creation per app entry, in app-owned code.
 * Mirrors packages/app/src/tamaguiConfig.ts.
 */
export const webTamaguiConfig = createTamaguiConfig(memorizeTheme);
