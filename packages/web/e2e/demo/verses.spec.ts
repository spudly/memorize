import { expect, test, type Page } from "@playwright/test";

/**
 * My Verses against seeded local state (issue #45). The store persists to
 * localStorage under `memorize:data:v1` (packages/core/src/storage.ts), so
 * seeding that key before the app boots exercises the real load path with
 * no demo-mode searching and no external accounts.
 */

const DATA_KEY = "memorize:data:v1";

interface SeedVerse {
  id: string;
  reference: string;
  text: string;
  status: "learning" | "memorized";
  nextReviewAt?: string;
}

function seedData(verses: SeedVerse[]): string {
  return JSON.stringify({
    version: 1,
    verses: verses.map((v) => ({
      verse: { id: v.id, reference: v.reference, text: v.text },
      status: v.status,
      addedAt: "2026-10-01T12:00:00.000Z",
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

async function seedVerses(page: Page, verses: SeedVerse[]): Promise<void> {
  const data = seedData(verses);
  // Seed only when storage is empty: addInitScript runs on every reload
  // too, and the persistence assertions below need the app's own writes
  // (removals) to survive reloads rather than be re-seeded over.
  await page.addInitScript(
    ([key, value]) => {
      if (window.localStorage.getItem(key) === null) {
        window.localStorage.setItem(key, value);
      }
    },
    [DATA_KEY, data] as const,
  );
}

const SEEDED: SeedVerse[] = [
  {
    id: "ether-12-27",
    reference: "Ether 12:27",
    text: "And if men come unto me I will show unto them their weakness.",
    status: "learning",
    nextReviewAt: "2999-01-01T00:00:00.000Z",
  },
  {
    id: "philippians-4-13",
    reference: "Philippians 4:13",
    text: "I can do all things through Christ which strengtheneth me.",
    status: "memorized",
    nextReviewAt: "2999-01-02T00:00:00.000Z",
  },
];

test("my verses renders seeded verses with their status and text", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await seedVerses(page, SEEDED);
  await page.goto("/");

  await expect(page.getByText("No verses yet")).toHaveCount(0);
  for (const v of SEEDED) {
    await expect(page.getByText(v.reference, { exact: true })).toBeVisible();
    await expect(page.getByText(v.text)).toBeVisible();
  }
  await expect(page.getByText("learning", { exact: true })).toBeVisible();
  await expect(page.getByText("memorized", { exact: true })).toBeVisible();
  await expect(page.getByText(/Next review:/)).toHaveCount(SEEDED.length);
  expect(errors).toEqual([]);
});

test("removing a seeded verse drops it from the list and persists", async ({ page }) => {
  await seedVerses(page, SEEDED);
  await page.goto("/");
  await expect(page.getByText("Philippians 4:13", { exact: true })).toBeVisible();

  // Remove the Ether card: its Remove button is the first in list order.
  await page.getByRole("button", { name: "Remove" }).first().click();
  await expect(page.getByText("Ether 12:27", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Philippians 4:13", { exact: true })).toBeVisible();

  // The removal is persisted to local storage, not just hidden.
  await page.reload();
  await expect(page.getByText("Ether 12:27", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Philippians 4:13", { exact: true })).toBeVisible();
  const stored = await page.evaluate((key) => window.localStorage.getItem(key), DATA_KEY);
  expect(stored).not.toContain("Ether 12:27");
  expect(stored).toContain("Philippians 4:13");
});
