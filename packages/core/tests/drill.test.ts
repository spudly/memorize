import { BLANK_FRACTIONS, blankedIndices, gradeRound, tokenize } from "../src/drill";

describe("tokenize", () => {
  test("splits on whitespace and keeps punctuation attached", () => {
    expect(tokenize("  For God so loved\nthe world, ")).toEqual([
      "For",
      "God",
      "so",
      "loved",
      "the",
      "world,",
    ]);
  });
});

describe("blankedIndices", () => {
  const words = tokenize("For God so loved the world that he gave his only begotten Son");

  test("round 0 blanks nothing", () => {
    expect(blankedIndices(words.length, 0, "john-3-16").size).toBe(0);
  });

  test("is deterministic for the same verse and round", () => {
    const a = [...blankedIndices(words.length, 3, "john-3-16")].sort();
    const b = [...blankedIndices(words.length, 3, "john-3-16")].sort();
    expect(a).toEqual(b);
  });

  test("blank counts match the configured fractions", () => {
    expect(blankedIndices(20, 1, "seed").size).toBe(Math.floor(20 * 0.2));
    expect(blankedIndices(20, 6, "seed").size).toBe(Math.floor(20 * 0.95));
  });

  test("blank counts grow with the round", () => {
    const counts = BLANK_FRACTIONS.map(
      (_, round) => blankedIndices(words.length, round, "john-3-16").size,
    );
    for (let i = 1; i < counts.length; i++) {
      const prev = counts[i - 1];
      const curr = counts[i];
      expect(prev).toBeDefined();
      expect(curr).toBeDefined();
      expect(curr as number).toBeGreaterThanOrEqual(prev as number);
    }
  });

  test("later rounds are a superset of earlier rounds", () => {
    const early = blankedIndices(words.length, 2, "john-3-16");
    const late = blankedIndices(words.length, 5, "john-3-16");
    for (const index of early) {
      expect(late.has(index)).toBe(true);
    }
  });

  test("handles an empty verse", () => {
    expect(blankedIndices(0, 3, "empty").size).toBe(0);
  });
});

describe("gradeRound", () => {
  test("a round with no blanks always passes", () => {
    expect(gradeRound(0, 0)).toBe("pass");
    expect(gradeRound(0, 5)).toBe("pass");
  });

  test("allows up to a quarter of the blanks as peeks", () => {
    expect(gradeRound(8, 2)).toBe("pass");
    expect(gradeRound(8, 3)).toBe("retry");
    expect(gradeRound(7, 2)).toBe("pass"); // ceil(1.75) = 2
    expect(gradeRound(7, 3)).toBe("retry");
  });
});
