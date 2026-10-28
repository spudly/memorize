import { useState } from "react";
import { Alert, Button, Card, EmptyState, SearchField, Spinner, Text } from "@spudly/ui";
import type { MemorizeStore, ScriptureDataSource, Verse } from "@memorize/core";

interface Props {
  store: MemorizeStore;
  dataSource: ScriptureDataSource;
  usingDemo: boolean;
}

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
  const libraryIds = new Set(store.getState().data.verses.map((entry) => entry.verse.id));

  const runSearch = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      setResults(await dataSource.search(query));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setBusy(false);
      setSearched(true);
    }
  };

  return (
    <>
      <Text variant="subheading">Search verses</Text>
      {usingDemo && (
        <Text variant="hint">
          Searching the built-in demo set. Add a gospel-engine API key in Settings for full-library
          search.
        </Text>
      )}
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="e.g. Ether 12:27 or “charity”"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            void runSearch();
          }
        }}
      />
      <Button onPress={() => void runSearch()} disabled={busy || !query.trim()}>
        Search
      </Button>
      {error && <Alert severity="error">{error}</Alert>}
      {busy && <Spinner label="Searching verses" />}
      {!busy && searched && results.length === 0 && !error && (
        <EmptyState title="No results" body="Try a different reference or keyword." />
      )}
      {results.map((v) => (
        <Card key={v.id}>
          <Text variant="body">{v.reference}</Text>
          <Text variant="verse">{v.text}</Text>
          {libraryIds.has(v.id) ? (
            <Button size="sm" variant="secondary" disabled>
              Added
            </Button>
          ) : (
            <Button size="sm" onPress={() => store.actions.addVerse(v)}>
              Add to memorize list
            </Button>
          )}
        </Card>
      ))}
    </>
  );
}
