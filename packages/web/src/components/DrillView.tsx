import { useMemo, useState } from "react";
import { BlankWord, Button, InlineAlert, ProgressBar, Text, VerseText } from "@spudly/ui";
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

export default function DrillView({ store, verseId, onBack }: Props) {
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
      <>
        <Text variant="body">Verse not found.</Text>
        <Button onPress={onBack}>Back</Button>
      </>
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
  const progress = ((round + 1) / BLANK_FRACTIONS.length) * 100;

  return (
    <>
      <Button variant="ghost" size="sm" onPress={onBack}>
        ← Back
      </Button>
      <Text variant="subheading">{entry.verse.reference}</Text>
      <ProgressBar value={progress} />
      <Text variant="hint">
        Round {round + 1} of {BLANK_FRACTIONS.length} — tap a blank to peek at the word.
      </Text>
      <VerseText>
        {words.map((word, i) =>
          blanks.has(i) ? (
            <BlankWord
              key={i}
              word={word}
              revealed={revealed.has(i)}
              onReveal={() => peek(i)}
              index={i}
              total={blanks.size}
            />
          ) : (
            <Text key={i} variant="verse">
              {word}{" "}
            </Text>
          ),
        )}
      </VerseText>
      {message && <InlineAlert severity="warning">{message}</InlineAlert>}
      <Button onPress={nextRound}>{isLastRound ? "Finish — mark memorized" : "Next round"}</Button>
    </>
  );
}
