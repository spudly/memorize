/**
 * Web stub for react-native-svg's fabric/NativeSvgSoundModule.
 *
 * That module is native-only: it calls
 * `TurboModuleRegistry.getEnforcing('RNSVGSoundModule')` at import
 * time, and react-native-web (this build's react-native alias)
 * exports no TurboModuleRegistry, so Rolldown fails the whole web
 * build on the missing export. The module is only ever loaded
 * lazily by SvgTouchableMixin for the touch-sound feature, which
 * no @spudly/ui component Memorize renders uses (its icons are
 * static shapes). The web build therefore aliases it to this
 * inert stub; native builds use the real module. Mirrors the
 * design system's own web Storybook wiring (.storybook/main.ts).
 */
export default null;
