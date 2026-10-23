import type { MemorizationSessionPageWord } from "@spudly/ui/pages";

/**
 * View-model mapping for the memorization session (#49): the pure
 * half of DrillScreen's contract with the design system's
 * MemorizationSessionPage. The session engine stays app-side in
 * @memorize/core (tokenizing, blank selection, grading, peek
 * counting, round advancement, persistence); these helpers only
 * shape what crosses to the view, so the mapping is testable
 * without rendering the screen.
 */

/**
 * The passage's words as the page renders them: a plain word
 * crosses as just its text; a word blanked this round also
 * carries whether the user has peeked at it. Indices are
 * preserved — a blank press comes back as the word's index in
 * this array.
 */
export function toSessionWords(
  words: readonly string[],
  blanks: ReadonlySet<number>,
  revealed: ReadonlySet<number>,
): MemorizationSessionPageWord[] {
  return words.map((text, i) =>
    blanks.has(i) ? { text, blank: { revealed: revealed.has(i) } } : { text },
  );
}

/** Whether the current round is the session's last — the page's
 * advance button reads "Finish — mark memorized" for it. */
export function isFinalRound(roundIndex: number, roundCount: number): boolean {
  return roundIndex + 1 >= roundCount;
}

/**
 * The retry feedback after a failed round, pre-composed app-side
 * because its wording embeds the engine's peek and blank counts;
 * the page renders it as the warning alert.
 */
export function retryFeedback(peeks: number, blankCount: number): string {
  return `Not quite — you peeked ${peeks} time(s) on ${blankCount} blank(s). Try the round again.`;
}
