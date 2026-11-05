/**
 * Web stub for `@react-native/assets-registry/registry`.
 *
 * react-native-svg's web build imports `getAssetByID` from that
 * package to resolve local image assets for its SvgUri / Image
 * features. The package is not part of this repo's dependency
 * tree, so Rolldown cannot resolve the import and fails the whole
 * web build. No @spudly/ui component Memorize renders uses svg
 * image-asset resolution (its icons are static shapes), so the web
 * build aliases the import to this stub, whose getAssetByID
 * resolves nothing. Native builds use the real package. Mirrors
 * the design system's own web Storybook wiring (.storybook/main.ts).
 */
export function getAssetByID(): undefined {
  return undefined;
}
