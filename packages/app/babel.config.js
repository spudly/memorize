/* eslint-disable import-x/no-commonjs, no-undef -- Babel configs are loaded by Babel/Metro as CommonJS; this file cannot be an ES module. */
// Babel config for @memorize/app (#110): previously Expo defaults
// (no committed config). The Lingui macro plugin is required so
// t/Trans/Plural macros compile under Metro/Hermes on RN 0.88 —
// validated in the #110 spike (see docs/voice.md companion issue
// comment): the Plural macro compiles to an ICU plural descriptor.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["@lingui/babel-plugin-lingui-macro"],
  };
};
