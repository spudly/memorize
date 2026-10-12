import { Button, FlatList, StyleSheet, Text, View } from "react-native";
import type { MemorizeStore } from "@memorize/core";

interface Props {
  store: MemorizeStore;
  onDrill(id: string): void;
}

export default function VersesScreen({ store, onDrill }: Props) {
  const { verses } = store.getState().data;

  if (verses.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>My verses</Text>
        <Text style={styles.hint}>No verses yet — find one in the Search tab to get started.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>My verses</Text>
      <FlatList
        data={verses}
        keyExtractor={(v) => v.verse.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.reference}>
              {item.verse.reference} · {item.status}
            </Text>
            <Text>{item.verse.text}</Text>
            {item.nextReviewAt && (
              <Text style={styles.hint}>
                Next review: {new Date(item.nextReviewAt).toLocaleDateString()}
              </Text>
            )}
            <View style={styles.row}>
              <Button title="Drill" onPress={() => onDrill(item.verse.id)} />
              <Button title="Remove" onPress={() => store.actions.removeVerse(item.verse.id)} />
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  heading: { fontSize: 20, fontWeight: "bold", marginBottom: 8 },
  hint: { color: "#666", fontSize: 13, marginTop: 4 },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  reference: { fontWeight: "bold", marginBottom: 4 },
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
});
