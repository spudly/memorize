import { Button, FlatList, StyleSheet, Text, View } from "react-native";
import { dueVerses, type MemorizeStore, type ReviewOutcome } from "@memorize/core";

interface Props {
  store: MemorizeStore;
}

export default function ReviewScreen({ store }: Props) {
  const due = dueVerses(store.getState().data.verses, new Date());

  const review = (id: string, outcome: ReviewOutcome): void => {
    store.actions.recordReview(id, outcome);
  };

  if (due.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Review</Text>
        <Text style={styles.hint}>Nothing due. Nice work.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Review ({due.length} due)</Text>
      <FlatList
        data={due}
        keyExtractor={(v) => v.verse.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.reference}>{item.verse.reference}</Text>
            <Text>{item.verse.text}</Text>
            <View style={styles.row}>
              <Button title="I remembered it" onPress={() => review(item.verse.id, "remembered")} />
              <Button title="I forgot it" onPress={() => review(item.verse.id, "forgot")} />
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
  hint: { color: "#666", fontSize: 13 },
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
