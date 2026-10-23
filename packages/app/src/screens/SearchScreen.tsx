import { useState } from "react";
import { VerseSearchPage, type VerseSearchPageItem } from "@spudly/ui/pages";
import type { MemorizeStore, ScriptureDataSource, Verse } from "@memorize/core";

/**
 * Search tab host (#49): renders the DS VerseSearchPage and keeps
 * every piece of state and business logic app-side — the query
 * text, the search against the scripture data source, the error
 * composition (the caught error's message, or the "Search failed"
 * fallback), and the store mutation. Results cross the boundary as
 * {id, reference, text} view-models (the Verse type's book/chapter
 * fields are not rendered by this screen); the page reports an add
 * by id and the host resolves it back to the full Verse the store
 * action takes, exactly the object the old row button passed.
 *
 * The page brings its own ScreenContainer shell (scrollable off),
 * per its DS contract; the app chrome — the "Memorize" title and
 * the tab bar in App.tsx — stays app-side.
 */
interface Props {
  store: MemorizeStore;
  dataSource: ScriptureDataSource;
  usingDemo: boolean;
}

export default function SearchScreen({ store, dataSource, usingDemo }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Verse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const runSearch = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      setResults(await dataSource.search(query));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setBusy(false);
    }
  };

  const items: VerseSearchPageItem[] = results.map((verse) => ({
    id: verse.id,
    reference: verse.reference,
    text: verse.text,
  }));

  const handleAddVerse = (verseId: string): void => {
    const verse = results.find((v) => v.id === verseId);
    if (verse) {
      store.actions.addVerse(verse);
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
      onAddVerse={handleAddVerse}
    />
  );
}
