import { i18n as globalI18n, setupI18n, type I18n, type Messages } from "@lingui/core";
import { messages as enUSMessages } from "./en-US";

/**
 * Lingui activation for @memorize/web (#110).
 *
 * Locale resolution precedence (decided 2026-11-07): a stored user
 * choice wins, then the device / `Accept-Language` candidates in
 * order, then en-US. Only en-US is a real locale for now; en-XA is
 * the standing pseudo-locale in the test matrix.
 *
 * The module is isomorphic: it touches no browser globals, so the
 * planned SSR work can import it server-side and activate an
 * explicit locale per request via {@link createI18n} /
 * {@link loadCatalog}. The exported `i18n` singleton is the
 * client-side instance; callers that render on the server should
 * create their own instance with an explicit locale argument.
 * @public — i18n foundation API (#110): public surface retained for the sequenced DS #539 voice wiring; exercised by the packages' i18n contract tests.
 */
export const SUPPORTED_LOCALES = ["en-US", "en-XA"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * @public — i18n foundation API (#110): public surface retained for the sequenced DS #539 voice wiring; exercised by the packages' i18n contract tests.
 */
export const DEFAULT_LOCALE: SupportedLocale = "en-US";

/** Storage key for the user's explicit locale choice. * @public — i18n foundation API (#110): public surface retained for the sequenced DS #539 voice wiring; exercised by the packages' i18n contract tests.
 */
export const LOCALE_STORAGE_KEY = "memorize.locale";

/**
 * Loaded catalogs, by locale. Only the default locale is bundled
 * statically (the sync singleton activation and view models need
 * it synchronously); every other locale is loaded on demand by
 * {@link loadCatalog} via dynamic import.
 */
const catalogs: Partial<Record<SupportedLocale, Messages>> = {
  "en-US": enUSMessages,
};

/**
 * Map an arbitrary language tag to a supported locale, or null when
 * nothing matches. Matching is by primary language: any `en-*`
 * variant resolves to en-US, except the pseudo-locale itself.
 * @public — i18n foundation API (#110): public surface retained for the sequenced DS #539 voice wiring; exercised by the packages' i18n contract tests.
 */
export function normalizeLocale(candidate: string | null | undefined): SupportedLocale | null {
  if (!candidate) {
    return null;
  }
  const tag = candidate.trim().replaceAll("_", "-");
  if (!tag) {
    return null;
  }
  const lower = tag.toLowerCase();
  if (lower === "en-xa") {
    return "en-XA";
  }
  if (lower === "en" || lower.startsWith("en-")) {
    return "en-US";
  }
  return null;
}

/**
 * Resolve the active locale: stored choice first, then each
 * device/header candidate in order, then the default.
 * @public — i18n foundation API (#110): public surface retained for the sequenced DS #539 voice wiring; exercised by the packages' i18n contract tests.
 */
export function resolveLocale(args: {
  stored?: string | null | undefined;
  candidates?: readonly (string | null | undefined)[] | undefined;
}): SupportedLocale {
  const stored = normalizeLocale(args.stored);
  if (stored) {
    return stored;
  }
  for (const candidate of args.candidates ?? []) {
    const matched = normalizeLocale(candidate);
    if (matched) {
      return matched;
    }
  }
  return DEFAULT_LOCALE;
}

/** Dynamically load a locale's compiled catalog (cached). * @public — i18n foundation API (#110): public surface retained for the sequenced DS #539 voice wiring; exercised by the packages' i18n contract tests.
 */
export async function loadCatalog(locale: SupportedLocale): Promise<Messages> {
  const cached = catalogs[locale];
  if (cached) {
    return cached;
  }
  const loaded = (await import("./en-XA")).messages;
  catalogs[locale] = loaded;
  return loaded;
}

/**
 * Create an activated i18n instance for an explicit locale. Pass
 * the catalog from {@link loadCatalog} for any locale that is not
 * loaded yet; the default locale is always available synchronously.
 * @public — i18n foundation API (#110): public surface retained for the sequenced DS #539 voice wiring; exercised by the packages' i18n contract tests.
 */
export function createI18n(locale: SupportedLocale = DEFAULT_LOCALE, messages?: Messages): I18n {
  const instance = setupI18n();
  const catalog = messages ?? catalogs[locale];
  if (!catalog) {
    throw new Error(`Catalog for ${locale} is not loaded yet — await loadCatalog() first`);
  }
  instance.loadAndActivate({ locale, messages: catalog });
  return instance;
}

/**
 * The client-side singleton: Lingui's global instance, activated
 * with the default locale. It must be the global instance because
 * macro-compiled code (`t`, `plural`, <Trans> from the Lingui
 * macros) translates through the instance @lingui/core exports;
 * a separate setupI18n() instance would not see those messages'
 * activation. Server-side rendering uses {@link createI18n}
 * instances instead, never this singleton.
 */
export const i18n: I18n = globalI18n;
i18n.loadAndActivate({ locale: DEFAULT_LOCALE, messages: enUSMessages });

/** Load a locale's catalog dynamically and activate it on the singleton. * @public — i18n foundation API (#110): public surface retained for the sequenced DS #539 voice wiring; exercised by the packages' i18n contract tests.
 */
export async function activateI18n(locale: SupportedLocale): Promise<I18n> {
  const messages = await loadCatalog(locale);
  i18n.loadAndActivate({ locale, messages });
  return i18n;
}

/**
 * Resolve and activate the locale for the browser client: the
 * stored choice in localStorage, then `navigator.languages`
 * (the client form of Accept-Language), then en-US.
 */
export async function activateForClient(): Promise<SupportedLocale> {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    stored = null;
  }
  const locale = resolveLocale({
    stored,
    candidates: typeof navigator !== "undefined" ? navigator.languages : [],
  });
  await activateI18n(locale);
  return locale;
}
