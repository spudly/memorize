import { MyVersesPage, type MyVersesPageItem } from "@spudly/ui";
import type { MemorizeStore } from "@memorize/core";

type Props = {
  store: MemorizeStore;
};

/**
 * "My verses" tab — a thin host over the DS MyVersesPage (#96).
 * The store and the remove mutation stay app-side. Drill
 * navigation is NOT a callback: each row carries its canonical
 * `/drill/<id>` href (DS #425) and App parses that route on load
 * and opens the drill session for the verse.
 *
 * The next-review line crosses pre-composed with the app's locale
 * date format; no scheduled review means the key is absent, so no
 * line renders (the page's contract).
 */
export default function VersesTab({ store }: Props) {
  const { verses } = store.getState().data;

  const items: MyVersesPageItem[] = verses.map((entry) => ({
    id: entry.verse.id,
    drillHref: `/drill/${encodeURIComponent(entry.verse.id)}`,
    reference: entry.verse.reference,
    text: entry.verse.text,
    status: entry.status,
    ...(entry.nextReviewAt
      ? {
          nextReviewLabel: `Next review: ${new Date(entry.nextReviewAt).toLocaleDateString()}`,
        }
      : {}),
  }));

  return <MyVersesPage verses={items} onRemoveVerse={(id) => void store.actions.removeVerse(id)} />;
}
