import { useEffect, useMemo, useRef, useState } from "react";
import { MemorizationSessionPage, type MemorizationSessionPageWord } from "@spudly/ui";
import {
  BLANK_FRACTIONS,
  blankedIndices,
  gradeRound,
  tokenize,
  type MemorizeStore,
} from "@memorize/core";

type Props = {
  store: MemorizeStore;
  verseId: string;
  onBack(): void;
};

/**
 * The memorization session view (#96): the session engine stays
 * here and in @memorize/core — tokenizing, blank selection,
 * grading, peek counting, round advancement, and the awaited
 * persistence of #91 — and the rendered surface is the design
 * system's MemorizationSessionPage, driven entirely through
 * props. Finishing the final round completes the drill and
 * navigates back, so the view has no "complete" state; a missing
 * verse is the page's not-found branch.
 */
export default function DrillView({ store, verseId, onBack }: Props) {
  const entry = store.getState().data.verses.find((v) => v.verse.id === verseId);
  const [round, setRound] = useState(entry?.drillRound ?? 0);
  const [peeks, setPeeks] = useState(entry?.drillPeeks ?? 0);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  // Whether this view is still mounted: leaving via the tabs
  // unmounts it, and a completion save that resolves afterwards
  // must not navigate — onBack clears whatever drill is open by
  // then, which could be a different verse's session (#91).
  const activeRef = useRef(true);
  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  const verseText = entry?.verse.text ?? "";
  const words = useMemo(() => tokenize(verseText), [verseText]);
  const blanks = useMemo(
    () => blankedIndices(words.length, round, verseId),
    [words.length, round, verseId],
  );

  if (!entry) {
    return <MemorizationSessionPage state="not-found" onBack={onBack} />;
  }

  const peek = async (index: number): Promise<void> => {
    if (revealed.has(index)) {
      return;
    }
    const nextRevealed = new Set(revealed);
    nextRevealed.add(index);
    setRevealed(nextRevealed);
    const nextPeeks = peeks + 1;
    setPeeks(nextPeeks);
    try {
      await store.actions.setDrillProgress(verseId, round, nextPeeks);
    } catch {
      setMessage("Couldn't save your progress — it isn't saved yet if you leave now.");
    }
  };

  const nextRound = async (): Promise<void> => {
    if (gradeRound(blanks.size, peeks) === "retry") {
      setMessage(
        `Not quite — you peeked ${peeks} time(s) on ${blanks.size} blank(s). Try the round again.`,
      );
      return;
    }
    if (round + 1 >= BLANK_FRACTIONS.length) {
      try {
        await store.actions.completeDrill(verseId);
      } catch {
        setMessage("Couldn't save finishing the drill. Try again before leaving.");
        return;
      }
      if (activeRef.current) {
        onBack();
      }
      return;
    }
    const next = round + 1;
    setRound(next);
    setPeeks(0);
    setRevealed(new Set());
    setMessage(null);
    try {
      await store.actions.setDrillProgress(verseId, next, 0);
    } catch {
      setMessage("Couldn't save your progress — it isn't saved yet if you leave now.");
    }
  };

  const sessionWords: MemorizationSessionPageWord[] = words.map((text, i) =>
    blanks.has(i) ? { text, blank: { revealed: revealed.has(i) } } : { text },
  );

  return (
    <MemorizationSessionPage
      state="ready"
      reference={entry.verse.reference}
      roundIndex={round}
      roundCount={BLANK_FRACTIONS.length}
      words={sessionWords}
      feedback={message}
      isFinalRound={round + 1 >= BLANK_FRACTIONS.length}
      onBack={onBack}
      onBlankReveal={(index) => void peek(index)}
      onAdvance={() => void nextRound()}
    />
  );
}
