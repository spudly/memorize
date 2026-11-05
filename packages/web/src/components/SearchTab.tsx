import { useState } from "react";
import { VerseSearchPage, type VerseSearchPageItem } from "@spudly/ui";
import { isSameVerse, suppliesMissingVerseIdentity } from "@memorize/core";
import type { MemorizeStore, ScriptureDataSource, Verse } from "@memorize/core";

type Props = {
  store: MemorizeStore;
  dataSource: ScriptureDataSource;
  usingDemo: boolean;
};

/**
 * Search tab host (#96): renders the DS VerseSearchPage and keeps
 * every piece of state and business logic app-side — the query,
 * the search against the scripture data source, the error
 * composition, and the store mutation. Results cross as
 * {id, reference, text, added} view-models; an add reported by id
 * resolves back to the full Verse the store action takes.
 */
export default function SearchTab({ store, dataSource, usingDemo }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Verse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);

  // The in-library state is derived from the store, not local click
  // state: App re-renders this tab on every store change, so a result's
  // button flips to "Added" in place the moment its add lands, and a
  // verse that is already in the library (the store dedupes re-adds)
  // shows "Added" from the start instead of an Add button that appears
  // to do nothing (#56 item 5).
  // Membership is by verse identity, not id alone (isSameVerse): a
  // verse saved before #79 under a legacy title-slug id is already in
  // the library even though this result's id differs from the saved
  // copy's id, and each chunk of a document is its own item — a
  // different chunk of a saved document still shows Add.
  const libraryVerses = store.getState().data.verses.map((entry) => entry.verse);

  const runSearch = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const found = await dataSource.search(query);
      // Reconcile legacy saves as results arrive, BEFORE membership
      // is rendered below: a result that matches a pre-#79 save only
      // via the legacy bridge (isSameVerse) renders as a disabled
      // "Added" button, so its addVerse path — the one that persists
      // the verified chunk identity onto the stored entry — would
      // never run and the entry would stay key-less, letting a
      // DIFFERENT document with the same title + text keep matching
      // it through the fallback. Calling addVerse for exactly those
      // bridge-matched, still-incomplete entries runs the store's
      // reconciliation branch (it annotates, never duplicates);
      // store state is re-read per result because a reconciliation
      // updates it synchronously. This happens here, not during
      // render — render must not mutate the store.
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
