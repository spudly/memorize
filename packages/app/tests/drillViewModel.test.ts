import { isFinalRound, retryFeedback, toSessionWords } from "../src/screens/drillViewModel";

describe("toSessionWords", () => {
  const words = ["For", "God", "so", "loved", "the", "world,"];

  test("round 0 blanks nothing: every word crosses as text only", () => {
    expect(toSessionWords(words, new Set(), new Set())).toEqual([
      { text: "For" },
      { text: "God" },
      { text: "so" },
      { text: "loved" },
      { text: "the" },
      { text: "world," },
    ]);
  });

  test("blanked words carry a blank state; plain words do not", () => {
    const view = toSessionWords(words, new Set([1, 4]), new Set());
    expect(view[0]).toEqual({ text: "For" });
    expect(view[1]).toEqual({ text: "God", blank: { revealed: false } });
    expect(view[4]).toEqual({ text: "the", blank: { revealed: false } });
    expect(view[5]).toEqual({ text: "world," });
  });

  test("a peeked blank crosses as revealed, by word index", () => {
    const view = toSessionWords(words, new Set([1, 4]), new Set([4]));
    expect(view[1]).toEqual({ text: "God", blank: { revealed: false } });
    expect(view[4]).toEqual({ text: "the", blank: { revealed: true } });
  });

  test("a revealed index that is not blanked crosses as a plain word", () => {
    const view = toSessionWords(words, new Set([1]), new Set([2]));
    expect(view[2]).toEqual({ text: "so" });
  });

  test("order and punctuation are preserved verbatim", () => {
    const view = toSessionWords(words, new Set([5]), new Set([5]));
    expect(view.map((w) => w.text)).toEqual(words);
    expect(view[5]).toEqual({ text: "world,", blank: { revealed: true } });
  });
});

describe("isFinalRound", () => {
  test("only the last round is final", () => {
    expect(isFinalRound(0, 5)).toBe(false);
    expect(isFinalRound(3, 5)).toBe(false);
    expect(isFinalRound(4, 5)).toBe(true);
  });
});

describe("retryFeedback", () => {
  test("composes the retry message with the peek and blank counts", () => {
    expect(retryFeedback(4, 9)).toBe(
      "Not quite — you peeked 4 time(s) on 9 blank(s). Try the round again.",
    );
    expect(retryFeedback(1, 2)).toBe(
      "Not quite — you peeked 1 time(s) on 2 blank(s). Try the round again.",
    );
  });
});
