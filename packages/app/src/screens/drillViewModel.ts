import type { MemorizationSessionPageWord } from "@spudly/ui";
import { i18n } from "../locales/i18n";

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

/**
 * The final round's completion flow (#91): the completion save is
 * awaited, and only a successful save navigates back — a failed
 * save surfaces `onSaveError` and stays on the drill so Finish can
 * be retried. A save that lands after the user has already left
 * this drill (tab switch unmounts the screen) must NOT navigate:
 * `onBack` clears whatever drill is open by then, which could be a
 * different verse's session, so navigation happens only while
 * `isActive()` still holds at resolution time.
 */
export async function finishDrill(args: {
  complete(): Promise<void>;
  isActive(): boolean;
  onBack(): void;
  onSaveError(): void;
}): Promise<void> {
  try {
    await args.complete();
  } catch {
    args.onSaveError();
    return;
  }
  if (args.isActive()) {
    args.onBack();
  }
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
  return i18n._({
    id: "drill.retryFeedback",
    message:
      "Not quite — you peeked {peeks, plural, one {# time} other {# times}} on {blanks, plural, one {# blank} other {# blanks}}. Try the round again.",
    values: { peeks, blanks: blankCount },
  });
}
