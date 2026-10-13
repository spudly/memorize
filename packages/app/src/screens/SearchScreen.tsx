import { useState } from "react";
import { FlatList } from "react-native";
import { XStack } from "tamagui";
import { Button, Card, InlineAlert, SearchField, Spinner, Text } from "@spudly/ui";
import type { MemorizeStore, ScriptureDataSource, Verse } from "@memorize/core";

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

  return (
    <>
      <Text variant="heading">Search verses</Text>
      {usingDemo && (
        <InlineAlert severity="info">
          Searching the built-in demo set. Add a gospel-engine API key in Settings for full-library
          search.
        </InlineAlert>
      )}
      <XStack gap="$2" alignItems="center">
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="e.g. Ether 12:27 or “charity”"
          onSubmitEditing={() => void runSearch()}
          style={{ flex: 1 }}
        />
        <Button onPress={() => void runSearch()} disabled={busy || !query.trim()}>
          Search
        </Button>
      </XStack>
      {error && <InlineAlert severity="error">{error}</InlineAlert>}
      {busy && <Spinner />}
      <FlatList
        style={{ flex: 1 }}
        data={results}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <Card marginBottom="$2">
            <Text variant="subheading">{item.reference}</Text>
            <Text variant="verse">{item.text}</Text>
            <Button size="sm" onPress={() => store.actions.addVerse(item)}>
              Add to memorize list
            </Button>
          </Card>
        )}
      />
    </>
  );
}
