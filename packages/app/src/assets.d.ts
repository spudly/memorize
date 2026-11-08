// Bundled font files load through Metro as registered asset ids.
declare module "*.ttf" {
  const asset: number;
  export default asset;
}

// Lingui Hermes polyfills (#110): side-effect imports with no
// bundled type declarations.
declare module "@formatjs/intl-locale/polyfill";
declare module "@formatjs/intl-pluralrules/polyfill";
declare module "@formatjs/intl-pluralrules/locale-data/en";
