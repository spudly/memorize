import type { MemorizedVerse, ReviewOutcome } from "@memorize/types";

/**
 * Spaced-repetition intervals in days, indexed by `reviewsCompleted`:
 * daily for a week, weekly for a month, monthly for a year, then annually.
 */
export const REVIEW_INTERVALS_DAYS: number[] = [
  ...new Array<number>(7).fill(1),
  ...new Array<number>(4).fill(7),
  ...new Array<number>(12).fill(30),
  ...new Array<number>(10).fill(365),
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** When the next review is due, given how many successful reviews are done. */
export function nextReviewDate(from: Date, reviewsCompleted: number): Date {
  const index = Math.min(Math.max(reviewsCompleted, 0), REVIEW_INTERVALS_DAYS.length - 1);
  const days = REVIEW_INTERVALS_DAYS[index] ?? 365;
  return new Date(from.getTime() + days * MS_PER_DAY);
}

/** Verses due for review at `now`, oldest first. */
export function dueVerses(verses: MemorizedVerse[], now: Date): MemorizedVerse[] {
  return verses
    .filter((v) => v.nextReviewAt !== undefined && new Date(v.nextReviewAt) <= now)
    .sort((a, b) => (a.nextReviewAt ?? "").localeCompare(b.nextReviewAt ?? ""));
}

/** Advance (or reset) a verse's review schedule after a review attempt. */
export function applyReview(v: MemorizedVerse, outcome: ReviewOutcome, now: Date): MemorizedVerse {
  if (outcome === "remembered") {
    const reviewsCompleted = v.reviewsCompleted + 1;
    return {
      ...v,
      reviewsCompleted,
      lastReviewedAt: now.toISOString(),
      nextReviewAt: nextReviewDate(now, reviewsCompleted).toISOString(),
    };
  }
  // Forgotten: back to the start of the daily schedule.
  return {
    ...v,
    reviewsCompleted: 0,
    lastReviewedAt: now.toISOString(),
    nextReviewAt: nextReviewDate(now, 0).toISOString(),
  };
}

/** Mark a verse memorized once its drill is complete; first review is tomorrow. */
export function markMemorized(v: MemorizedVerse, now: Date): MemorizedVerse {
  return {
    ...v,
    status: "memorized",
    memorizedAt: now.toISOString(),
    reviewsCompleted: 0,
    nextReviewAt: nextReviewDate(now, 0).toISOString(),
  };
}
