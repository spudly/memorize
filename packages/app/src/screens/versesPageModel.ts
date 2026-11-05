import type { MyVersesPageItem } from "@spudly/ui";
import type { MemorizedVerse } from "@memorize/types";

/**
 * Compose one store entry into MyVersesPage's row view-model
 * (#49). Only the fields the row renders cross the boundary: the
 * verse's id, reference, and text, plus its status (the page
 * renders the status as the badge text and derives the badge tone
 * from it).
 *
 * The Drill control is a link (#248 / DS #425): the host owns a
 * canonical drill destination for every verse, so the row carries
 * the pre-composed `drillHref` — this host's is its deep link,
 * `memorize://drill/<id>`, which App handles and opens the drill
 * screen for that verse. There is no callback form.
 *
 * The next-review line crosses pre-composed: the app formats the
 * stored timestamp with its locale date format, and locale
 * formatting is the app's business — the page renders the finished
 * line verbatim. No scheduled review means the key is absent (not
 * undefined), so no line renders.
 */
export function toMyVersesPageItem(entry: MemorizedVerse): MyVersesPageItem {
  return {
    id: entry.verse.id,
    drillHref: `memorize://drill/${encodeURIComponent(entry.verse.id)}`,
    reference: entry.verse.reference,
    text: entry.verse.text,
    status: entry.status,
    ...(entry.nextReviewAt
      ? {
          nextReviewLabel: `Next review: ${new Date(entry.nextReviewAt).toLocaleDateString()}`,
        }
      : {}),
  };
}

/** Compose the app's memorize list, in the app's order. */
export function toMyVersesPageItems(entries: readonly MemorizedVerse[]): MyVersesPageItem[] {
  return entries.map(toMyVersesPageItem);
}
