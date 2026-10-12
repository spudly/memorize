import { useMemo, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import {
  BLANK_FRACTIONS,
  blankedIndices,
  gradeRound,
  tokenize,
  type MemorizeStore,
} from "@memorize/core";

interface Props {
  store: MemorizeStore;
  verseId: string;
  onBack(): void;
}

export default function DrillScreen({ store, verseId, onBack }: Props) {
  const entry = store.getState().data.verses.find((v) => v.verse.id === verseId);
  const [round, setRound] = useState(entry?.drillRound ?? 0);
  const [peeks, setPeeks] = useState(entry?.drillPeeks ?? 0);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<string | null>(null);

  const verseText = entry?.verse.text ?? "";
  const words = useMemo(() => tokenize(verseText), [verseText]);
  const blanks = useMemo(
    () => blankedIndices(words.length, round, verseId),
    [words.length, round, verseId],
  );

  if (!entry) {
    return (
      <View style={styles.container}>
        <Text>Verse not found.</Text>
        <Button title="Back" onPress={onBack} />
      </View>
    );
  }

  const peek = (index: number): void => {
    if (revealed.has(index)) {
      return;
    }
    const nextRevealed = new Set(revealed);
    nextRevealed.add(index);
    setRevealed(nextRevealed);
    const nextPeeks = peeks + 1;
    setPeeks(nextPeeks);
    store.actions.setDrillProgress(verseId, round, nextPeeks);
  };

  const nextRound = (): void => {
    if (gradeRound(blanks.size, peeks) === "retry") {
      setMessage(
        `Not quite — you peeked ${peeks} time(s) on ${blanks.size} blank(s). Try the round again.`,
      );
      return;
    }
    if (round + 1 >= BLANK_FRACTIONS.length) {
      store.actions.completeDrill(verseId);
      onBack();
      return;
    }
    const next = round + 1;
    setRound(next);
    setPeeks(0);
    setRevealed(new Set());
    setMessage(null);
    store.actions.setDrillProgress(verseId, next, 0);
  };

  const isLastRound = round + 1 >= BLANK_FRACTIONS.length;

  return (
    <View style={styles.container}>
      <Button title="← Back" onPress={onBack} />
      <Text style={styles.heading}>{entry.verse.reference}</Text>
      <Text style={styles.hint}>
        Round {round + 1} of {BLANK_FRACTIONS.length} — tap a blank to peek at the word.
      </Text>
      <View style={styles.textBox}>
        <Text style={styles.text}>
          {words.map((word, i) =>
            blanks.has(i) && !revealed.has(i) ? (
              <Text key={i} onPress={() => peek(i)} style={styles.blank}>
                {"______ "}
              </Text>
            ) : (
              <Text key={i}>{word} </Text>
            ),
          )}
        </Text>
      </View>
      {message && <Text style={styles.error}>{message}</Text>}
      <Button title={isLastRound ? "Finish — mark memorized" : "Next round"} onPress={nextRound} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  heading: { fontSize: 20, fontWeight: "bold", marginVertical: 8 },
  hint: { color: "#666", fontSize: 13, marginBottom: 8 },
  textBox: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  text: { fontSize: 18, lineHeight: 30 },
  blank: { fontFamily: "monospace", color: "#1a73e8" },
  error: { color: "#b00020", marginBottom: 8 },
});
