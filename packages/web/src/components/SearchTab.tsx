import { useState } from "react";
import { Alert, Button, Card, EmptyState, SearchField, Spinner, Text } from "@spudly/ui";
import { isSameVerse } from "@memorize/core";
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
              (entry.verse.chunkKey === undefined ||
                entry.verse.sourceType === undefined ||
                entry.verse.sourceId === undefined) &&
              (result.chunkKey !== undefined ||
                result.sourceType !== undefined ||
                result.sourceId !== undefined) &&
              isSameVerse(entry.verse, result),
          );
        if (needsReconcile) {
          store.actions.addVerse(result);
        }
      }
      setResults(found);
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
        placeholder={usingDemo ? "e.g. Ether 12:27 or “weakness”" : "e.g. Ether 12:27 or “charity”"}
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
          {libraryVerses.some((saved) => isSameVerse(saved, v)) ? (
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
