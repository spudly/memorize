import { useState } from "react";
import { VerseSearchPage, type VerseSearchPageItem } from "@spudly/ui";
import { isSameVerse, suppliesMissingVerseIdentity } from "@memorize/core";
import type { MemorizeStore, ScriptureDataSource, Verse } from "@memorize/core";

/**
 * Search tab host (#49): renders the DS VerseSearchPage and keeps
 * every piece of state and business logic app-side — the query
 * text, the search against the scripture data source, the error
 * composition (the caught error's message, or the "Search failed"
 * fallback), and the store mutation. Results cross the boundary as
 * {id, reference, text, added} view-models (the Verse type's
 * book/chapter fields are not rendered by this screen); the page
 * reports an add by id and the host resolves it back to the full
 * Verse the store action takes, exactly the object the old row
 * button passed.
 *
 * The `added` state is derived from the store by verse identity
 * (isSameVerse), not local click state, and `hasSearched` drives
 * the page's no-results empty state — mirroring the web host.
 *
 * The page brings its own ScreenContainer shell (scrollable off),
 * per its DS contract; the app chrome — the "Memorize" title and
 * the tab bar in App.tsx — stays app-side.
 */
type Props = {
  store: MemorizeStore;
  dataSource: ScriptureDataSource;
  usingDemo: boolean;
};

export default function SearchScreen({ store, dataSource, usingDemo }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Verse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);

  const libraryVerses = store.getState().data.verses.map((entry) => entry.verse);

  const runSearch = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const found = await dataSource.search(query);
      // Reconcile legacy saves as results arrive, BEFORE membership
      // is rendered below (see the web host for the full rationale):
      // a result that matches a pre-#79 save only via the legacy
      // bridge renders as "Added", so its addVerse path — the one
      // that persists the verified chunk identity — would never run.
      for (const result of found) {
        const needsReconcile = store
          .getState()
          .data.verses.some(
            (entry) =>
              suppliesMissingVerseIdentity(entry.verse, result) && isSameVerse(entry.verse, result),
          );
        if (needsReconcile) {
          void store.actions.addVerse(result);
        }
      }
      setResults(found);
      setSearched(true);
    } catch (e) {
      // A failed search is not a completed one: clear stale results and
      // keep hasSearched false so the page shows the error alone, never
      // an empty-result message next to it.
      setResults([]);
      setSearched(false);
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setBusy(false);
    }
  };

  const items: VerseSearchPageItem[] = results.map((verse) => ({
    id: verse.id,
    reference: verse.reference,
    text: verse.text,
    added: libraryVerses.some((saved) => isSameVerse(saved, verse)),
  }));

  const handleAddVerse = (verseId: string): void => {
    const verse = results.find((v) => v.id === verseId);
    if (verse) {
      void store.actions.addVerse(verse);
    }
  };

  return (
    <VerseSearchPage
      query={query}
      onQueryChange={setQuery}
      onSearch={() => void runSearch()}
      isSearching={busy}
      usingDemo={usingDemo}
      errorMessage={error}
      results={items}
      hasSearched={searched}
      onAddVerse={handleAddVerse}
    />
  );
}
