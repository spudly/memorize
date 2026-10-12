import { useMemo, useState } from "react";
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
      <section>
        <p>Verse not found.</p>
        <button onClick={onBack}>Back</button>
      </section>
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
    <section>
      <button onClick={onBack}>← Back</button>
      <h2>{entry.verse.reference}</h2>
      <p className="hint">
        Round {round + 1} of {BLANK_FRACTIONS.length} — tap a blank to peek at the word.
      </p>
      <p className="drill-text">
        {words.map((word, i) =>
          blanks.has(i) && !revealed.has(i) ? (
            <button key={i} className="blank" onClick={() => peek(i)} aria-label="reveal word">
              ______
            </button>
          ) : (
            <span key={i}>{word} </span>
          ),
        )}
      </p>
      {message && <p className="error">{message}</p>}
      <button onClick={nextRound}>{isLastRound ? "Finish — mark memorized" : "Next round"}</button>
    </section>
  );
}
