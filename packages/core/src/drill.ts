/**
 * Progressive cloze drill: each round blanks out a larger fraction of the
 * verse's words. Blank selection is deterministic per verse+round (seeded by
 * the verse id), and later rounds are a superset of earlier ones.
 */

/** Fraction of words blanked at each round (round 0 shows the full verse). */
export const BLANK_FRACTIONS = [0, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95];

/** Split on whitespace; punctuation stays attached to its word. */
export function tokenize(text: string): string[] {
  return text.split(/\s+/).filter((t) => t.length > 0);
}

function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic set of word indices to blank for a round.
 * `seed` should be the verse id so blanks are stable per verse.
 */
export function blankedIndices(wordCount: number, round: number, seed: string): Set<number> {
  const result = new Set<number>();
  if (wordCount <= 0) {
    return result;
  }
  const clamped = Math.min(Math.max(round, 0), BLANK_FRACTIONS.length - 1);
  const fraction = BLANK_FRACTIONS[clamped] ?? 0;
  const count = Math.floor(wordCount * fraction);
  if (count <= 0) {
    return result;
  }
  // One stable shuffle per verse; each round takes a longer prefix, so later
  // rounds always contain the earlier rounds' blanks.
  const order: number[] = Array.from({ length: wordCount }, (_, i) => i);
  const rand = mulberry32(hashSeed(seed));
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = order[i];
    const b = order[j];
    if (a !== undefined && b !== undefined) {
      order[i] = b;
      order[j] = a;
    }
  }
  for (let i = 0; i < count; i++) {
    const index = order[i];
    if (index !== undefined) {
      result.add(index);
    }
  }
  return result;
}

/**
 * Grade a drill round. A round passes when peeks stay within a quarter of the
 * blanked words (rounded up). A round with no blanks always passes.
 */
export function gradeRound(blankCount: number, peeks: number): "pass" | "retry" {
  if (blankCount <= 0) {
    return "pass";
  }
  return peeks <= Math.ceil(blankCount * 0.25) ? "pass" : "retry";
}
