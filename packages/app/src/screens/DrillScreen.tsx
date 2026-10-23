import { useMemo, useState } from "react";
import { MemorizationSessionPage } from "@spudly/ui/pages";
import {
  BLANK_FRACTIONS,
  blankedIndices,
  gradeRound,
  tokenize,
  type MemorizeStore,
} from "@memorize/core";
import { isFinalRound, retryFeedback, toSessionWords } from "./drillViewModel";

interface Props {
  store: MemorizeStore;
  verseId: string;
  onBack(): void;
}

/**
 * The memorization session screen (#49): the session engine
 * stays here and in @memorize/core — tokenizing, blank
 * selection, grading, peek counting, round advancement, and
 * persistence — and the rendered surface is the design system's
 * MemorizationSessionPage, driven entirely through props (see
 * drillViewModel for the word/feedback mapping). Finishing the
 * final round completes the drill and navigates back, so the
 * view has no "complete" state; a missing verse is the page's
 * not-found branch.
 */
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
    return <MemorizationSessionPage state="not-found" onBack={onBack} />;
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
      setMessage(retryFeedback(peeks, blanks.size));
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

  return (
    <MemorizationSessionPage
      state="ready"
      reference={entry.verse.reference}
      roundIndex={round}
      roundCount={BLANK_FRACTIONS.length}
      words={toSessionWords(words, blanks, revealed)}
      feedback={message}
      isFinalRound={isFinalRound(round, BLANK_FRACTIONS.length)}
      onBack={onBack}
      onBlankReveal={peek}
      onAdvance={nextRound}
    />
  );
}
