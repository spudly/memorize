import type { MemorizedVerse } from "@memorize/types";
import {
  REVIEW_INTERVALS_DAYS,
  applyReview,
  dueVerses,
  markMemorized,
  nextReviewDate,
} from "../src/schedule";

const DAY = 24 * 60 * 60 * 1000;

function makeVerse(overrides: Partial<MemorizedVerse> = {}): MemorizedVerse {
  return {
    verse: { id: "ether-12-27", reference: "Ether 12:27", text: "sample" },
    status: "memorized",
    addedAt: "2026-01-01T00:00:00.000Z",
    drillRound: 0,
    drillPeeks: 0,
    reviewsCompleted: 0,
    ...overrides,
  };
}

describe("nextReviewDate", () => {
  const from = new Date("2026-01-01T12:00:00.000Z");

  test("reviews daily for the first week", () => {
    for (let i = 0; i < 7; i++) {
      expect(nextReviewDate(from, i).getTime()).toBe(from.getTime() + DAY);
    }
  });

  test("reviews weekly for the next month", () => {
    for (let i = 7; i < 11; i++) {
      expect(nextReviewDate(from, i).getTime()).toBe(from.getTime() + 7 * DAY);
    }
  });

  test("reviews monthly for the next year", () => {
    for (let i = 11; i < 23; i++) {
      expect(nextReviewDate(from, i).getTime()).toBe(from.getTime() + 30 * DAY);
    }
  });

  test("reviews annually thereafter, clamped to the last interval", () => {
    expect(nextReviewDate(from, 23).getTime()).toBe(from.getTime() + 365 * DAY);
    expect(nextReviewDate(from, 10_000).getTime()).toBe(from.getTime() + 365 * DAY);
  });

  test("interval table has the expected shape", () => {
    expect(REVIEW_INTERVALS_DAYS.slice(0, 7)).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect(REVIEW_INTERVALS_DAYS.slice(7, 11)).toEqual([7, 7, 7, 7]);
    expect(REVIEW_INTERVALS_DAYS.slice(11, 23)).toEqual(new Array(12).fill(30));
  });
});

describe("applyReview", () => {
  test("remembered advances the schedule", () => {
    const now = new Date("2026-02-01T00:00:00.000Z");
    const updated = applyReview(makeVerse({ reviewsCompleted: 7 }), "remembered", now);
    expect(updated.reviewsCompleted).toBe(8);
    expect(updated.lastReviewedAt).toBe(now.toISOString());
    expect(updated.nextReviewAt).toBe(new Date(now.getTime() + 7 * DAY).toISOString());
  });

  test("forgotten resets to the daily schedule", () => {
    const now = new Date("2026-02-01T00:00:00.000Z");
    const updated = applyReview(
      makeVerse({ reviewsCompleted: 15, status: "memorized" }),
      "forgot",
      now,
    );
    expect(updated.reviewsCompleted).toBe(0);
    expect(updated.lastReviewedAt).toBe(now.toISOString());
    expect(updated.nextReviewAt).toBe(new Date(now.getTime() + DAY).toISOString());
  });
});

describe("markMemorized", () => {
  test("starts the review schedule with a review tomorrow", () => {
    const now = new Date("2026-03-01T00:00:00.000Z");
    const updated = markMemorized(makeVerse({ status: "learning" }), now);
    expect(updated.status).toBe("memorized");
    expect(updated.memorizedAt).toBe(now.toISOString());
    expect(updated.reviewsCompleted).toBe(0);
    expect(updated.nextReviewAt).toBe(new Date(now.getTime() + DAY).toISOString());
  });
});

describe("dueVerses", () => {
  test("returns due verses sorted by next review, skipping unscheduled ones", () => {
    const now = new Date("2026-04-01T00:00:00.000Z");
    const overdue = makeVerse({
      verse: { id: "a", reference: "A", text: "a" },
      nextReviewAt: "2026-03-01T00:00:00.000Z",
    });
    const dueNow = makeVerse({
      verse: { id: "b", reference: "B", text: "b" },
      nextReviewAt: now.toISOString(),
    });
    const future = makeVerse({
      verse: { id: "c", reference: "C", text: "c" },
      nextReviewAt: "2026-05-01T00:00:00.000Z",
    });
    const unscheduled = makeVerse({
      verse: { id: "d", reference: "D", text: "d" },
    });
    const due = dueVerses([future, dueNow, unscheduled, overdue], now);
    expect(due.map((v) => v.verse.id)).toEqual(["a", "b"]);
  });
});
