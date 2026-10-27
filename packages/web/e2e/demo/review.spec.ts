import { expect, test, type Page } from "@playwright/test";

/**
 * Review grading against seeded local state (issue #45). A verse is due
 * when its `nextReviewAt` is in the past (packages/core/src/schedule.ts);
 * grading "remembered" or "forgot" reschedules it, so a graded verse
 * leaves the due list and the session ends at the "Nothing due" state.
 * The web Review tab shows the verse text with the two grade buttons —
 * there is no separate reveal step in this UI.
 */

const DATA_KEY = "memorize:data:v1";

function seedData(
  verses: { id: string; reference: string; text: string; nextReviewAt: string }[],
): string {
  return JSON.stringify({
    version: 1,
    verses: verses.map((v) => ({
      verse: { id: v.id, reference: v.reference, text: v.text },
      status: "memorized",
      addedAt: "2026-10-01T12:00:00.000Z",
      memorizedAt: "2026-10-02T12:00:00.000Z",
      drillRound: 0,
      drillPeeks: 0,
      reviewsCompleted: 0,
      nextReviewAt: v.nextReviewAt,
    })),
    settings: {
      gospelEngineBaseUrl: "https://engine.ibeco.me",
      driveFolderName: "Memorize",
    },
    updatedAt: "2026-10-01T12:00:00.000Z",
  });
}

async function seed(page: Page, data: string): Promise<void> {
  // Seed only when storage is empty: addInitScript runs on every reload
  // too, and the grading assertions need the app's rescheduled dates to
  // survive reloads rather than be re-seeded over.
  await page.addInitScript(
    ([key, value]) => {
      if (window.localStorage.getItem(key) === null) {
        window.localStorage.setItem(key, value);
      }
    },
    [DATA_KEY, data] as const,
  );
}

const DUE = {
  id: "ether-12-27",
  reference: "Ether 12:27",
  text: "And if men come unto me I will show unto them their weakness.",
  nextReviewAt: "2020-01-01T00:00:00.000Z",
};
const NOT_DUE = {
  id: "philippians-4-13",
  reference: "Philippians 4:13",
  text: "I can do all things through Christ which strengtheneth me.",
  nextReviewAt: "2999-01-01T00:00:00.000Z",
};

async function openReview(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("tab", { name: "Review" }).click();
}

test("review lists only due verses, not future ones", async ({ page }) => {
  await seed(page, seedData([DUE, NOT_DUE]));
  await openReview(page);
  await expect(page.getByText("Review (1 due)")).toBeVisible();
  await expect(page.getByText("Ether 12:27", { exact: true })).toBeVisible();
  await expect(page.getByText("Philippians 4:13", { exact: true })).toHaveCount(0);
});

test("grading 'remembered' completes the session and persists the new schedule", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await seed(page, seedData([DUE]));
  await openReview(page);
  await expect(page.getByText("Review (1 due)")).toBeVisible();

  await page.getByRole("button", { name: "I remembered it" }).click();
  await expect(page.getByText("Nothing due")).toBeVisible();

  // Persisted: reviewsCompleted advanced and the next review is future.
  const stored = await page.evaluate((key) => window.localStorage.getItem(key), DATA_KEY);
  const parsed = JSON.parse(stored ?? "{}") as {
    verses: { reviewsCompleted: number; nextReviewAt: string }[];
  };
  expect(parsed.verses[0]?.reviewsCompleted).toBe(1);
  expect(new Date(parsed.verses[0]?.nextReviewAt ?? 0).getTime()).toBeGreaterThan(Date.now());

  // Still nothing due after a reload.
  await page.reload();
  await page.getByRole("tab", { name: "Review" }).click();
  await expect(page.getByText("Nothing due")).toBeVisible();
  expect(errors).toEqual([]);
});

test("grading 'forgot' clears the verse from due and resets its progress", async ({ page }) => {
  await seed(page, seedData([DUE]));
  await openReview(page);
  await page.getByRole("button", { name: "I forgot it" }).click();
  await expect(page.getByText("Nothing due")).toBeVisible();

  const stored = await page.evaluate((key) => window.localStorage.getItem(key), DATA_KEY);
  const parsed = JSON.parse(stored ?? "{}") as {
    verses: { reviewsCompleted: number; nextReviewAt: string }[];
  };
  expect(parsed.verses[0]?.reviewsCompleted).toBe(0);
  expect(new Date(parsed.verses[0]?.nextReviewAt ?? 0).getTime()).toBeGreaterThan(Date.now());
});

test("with no verses stored, review shows the nothing-due empty state", async ({ page }) => {
  await openReview(page);
  await expect(page.getByText("Nothing due")).toBeVisible();
});
