import { useState } from "react";
import { Button, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
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
    <View style={styles.container}>
      <Text style={styles.heading}>Search verses</Text>
      {usingDemo && (
        <Text style={styles.hint}>
          Searching the built-in demo set. Add a gospel-engine API key in Settings for full-library
          search.
        </Text>
      )}
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="e.g. Ether 12:27 or “charity”"
          onSubmitEditing={() => void runSearch()}
        />
        <Button title="Search" onPress={() => void runSearch()} disabled={busy || !query.trim()} />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={results}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.reference}>{item.reference}</Text>
            <Text>{item.text}</Text>
            <Button title="Add to memorize list" onPress={() => store.actions.addVerse(item)} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  heading: { fontSize: 20, fontWeight: "bold", marginBottom: 8 },
  hint: { color: "#666", fontSize: 13, marginBottom: 8 },
  row: { flexDirection: "row", gap: 8, marginBottom: 8, alignItems: "center" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 8,
  },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  reference: { fontWeight: "bold", marginBottom: 4 },
  error: { color: "#b00020", marginBottom: 8 },
});
