import { useState } from "react";
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

  return (
    <section>
      <h2>Search verses</h2>
      {usingDemo && (
        <p className="hint">
          Searching the built-in demo set. Add a gospel-engine API key in Settings for full-library
          search.
        </p>
      )}
      <div className="row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Ether 12:27 or “charity”"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void runSearch();
            }
          }}
        />
        <button onClick={() => void runSearch()} disabled={busy || !query.trim()}>
          Search
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <ul className="verse-list">
        {results.map((v) => (
          <li key={v.id}>
            <strong>{v.reference}</strong>
            <p>{v.text}</p>
            <button onClick={() => store.actions.addVerse(v)}>Add to memorize list</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
