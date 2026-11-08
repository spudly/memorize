import {
  activateI18n,
  createI18n,
  i18n,
  loadCatalog,
  normalizeLocale,
  resolveLocale,
} from "./i18n";
import { retryFeedback } from "../screens/drillViewModel";

/**
 * Locale negotiation + catalog activation tests (#110): the
 * precedence is stored choice > device candidates > en-US, and
 * the compiled catalogs render ICU plurals in en-US and in the
 * en-XA pseudo-locale (the standing second locale).
 */
describe("resolveLocale precedence", () => {
  it("prefers the stored choice over device locales", () => {
    expect(resolveLocale({ stored: "en-XA", candidates: ["en-US"] })).toBe("en-XA");
  });

  it("falls through device candidates in order", () => {
    expect(resolveLocale({ stored: null, candidates: ["fr-FR", "en-GB"] })).toBe("en-US");
    expect(resolveLocale({ candidates: ["en-XA", "en-US"] })).toBe("en-XA");
  });

  it("defaults to en-US when nothing matches", () => {
    expect(resolveLocale({ stored: "de-DE", candidates: ["fr-FR"] })).toBe("en-US");
    expect(resolveLocale({})).toBe("en-US");
  });

  it("normalizes regional English tags to en-US and rejects others", () => {
    expect(normalizeLocale("en_GB")).toBe("en-US");
    expect(normalizeLocale("EN-us")).toBe("en-US");
    expect(normalizeLocale("es-ES")).toBeNull();
    expect(normalizeLocale(null)).toBeNull();
  });
});

describe("catalog activation and plural rendering", () => {
  it("renders en-US messages from the compiled catalog", () => {
    const instance = createI18n("en-US");
    expect(instance._({ id: "tab.search", message: "Search" })).toBe("Search");
    expect(instance._({ id: "app.title", message: "Memorize" })).toBe("Memorize");
  });

  it("renders the ICU plural message in en-US", () => {
    const instance = createI18n("en-US");
    const render = (peeks: number, blanks: number) =>
      instance._({
        id: "drill.retryFeedback",
        message:
          "Not quite — you peeked {peeks, plural, one {# time} other {# times}} on {blanks, plural, one {# blank} other {# blanks}}. Try the round again.",
        values: { peeks, blanks },
      });
    expect(render(1, 1)).toBe("Not quite — you peeked 1 time on 1 blank. Try the round again.");
    expect(render(4, 9)).toBe("Not quite — you peeked 4 times on 9 blanks. Try the round again.");
  });

  it("renders the ICU plural message in en-XA with pseudo-localized text", async () => {
    const instance = createI18n("en-XA", await loadCatalog("en-XA"));
    const render = (peeks: number) =>
      instance._({
        id: "drill.retryFeedback",
        message:
          "Not quite — you peeked {peeks, plural, one {# time} other {# times}} on {blanks, plural, one {# blank} other {# blanks}}. Try the round again.",
        values: { peeks, blanks: 2 },
      });
    expect(render(1)).toContain("ţĩḿē");
    expect(render(1)).not.toContain("ţĩḿēś");
    expect(render(4)).toContain("ţĩḿēś");
    expect(instance._({ id: "tab.search", message: "Search" })).toContain("Śēàŕćĥ");
  });

  it("activates a locale on the shared singleton", async () => {
    await activateI18n("en-XA");
    expect(i18n.locale).toBe("en-XA");
    await activateI18n("en-US");
    expect(i18n.locale).toBe("en-US");
  });

  it("retryFeedback renders through the catalog in en-US", () => {
    expect(retryFeedback(1, 2)).toBe(
      "Not quite — you peeked 1 time on 2 blanks. Try the round again.",
    );
    expect(retryFeedback(4, 9)).toBe(
      "Not quite — you peeked 4 times on 9 blanks. Try the round again.",
    );
  });
});
