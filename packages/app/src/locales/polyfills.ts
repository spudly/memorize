/**
 * Hermes polyfills for Lingui (#110): Hermes lacks
 * `Intl.PluralRules` and `Intl.Locale`, which Lingui's ICU plural
 * handling needs. These must be imported before any catalog
 * activation — src/App.tsx imports this module first.
 */
import "@formatjs/intl-locale/polyfill";
import "@formatjs/intl-pluralrules/polyfill";
import "@formatjs/intl-pluralrules/locale-data/en";
