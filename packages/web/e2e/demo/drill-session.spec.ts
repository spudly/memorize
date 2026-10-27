import { expect, test, type Page } from "@playwright/test";

/**
 * Full drill sessions (issue #45): app.spec.ts covers entering the drill
 * and revealing a blank; these specs cover completing a whole session
 * (which marks the verse memorized) and the fail path (too many peeks
 * holds the round with a retry message). Both run in demo mode: adding a
 * verse from the built-in set needs no account or network.
 */

async function addDemoVerse(page: Page, reference: string): Promise<void> {
  await page.getByRole("tab", { name: "Search" }).click();
  await page.getByPlaceholder(/Ether 12:27/).fill(reference);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText(reference, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add to memorize list" }).click();
  await page.getByRole("tab", { name: "My verses" }).click();
  await expect(page.getByText(reference, { exact: true })).toBeVisible();
}

test("completing every drill round marks the verse memorized", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto("/");
  // Short verse: 9 words, so later rounds blank only a handful of words.
  await addDemoVerse(page, "Philippians 4:13");

  await page.getByRole("button", { name: "Drill" }).click();
  await expect(page.getByText(/Round 1 of 7/)).toBeVisible();

  // No peeks: every round grades as a pass. Six "Next round" clicks walk
  // rounds 1→7; the last round's button finishes the drill.
  for (let round = 2; round <= 7; round++) {
    await page.getByRole("button", { name: "Next round" }).click();
    await expect(page.getByText(new RegExp(`Round ${round} of 7`))).toBeVisible();
  }
  await page.getByRole("button", { name: "Finish — mark memorized" }).click();

  // Finishing returns to My Verses with the status flipped, persisted.
  await expect(page.getByText("Philippians 4:13", { exact: true })).toBeVisible();
  await expect(page.getByText("memorized", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("memorized", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("peeking at too many blanks holds the round with a retry message", async ({ page }) => {
  await page.goto("/");
  await addDemoVerse(page, "2 Nephi 2:25");

  await page.getByRole("button", { name: "Drill" }).click();
  await page.getByRole("button", { name: "Next round" }).click();
  await expect(page.getByText(/Round 2 of 7/)).toBeVisible();

  // Round 2 blanks 20% of the words; a round only passes with peeks in
  // the first quarter of the blanks, so revealing every blank must fail.
  const blanks = page.getByRole("button", { name: /^_+$/ });
  const blankCount = await blanks.count();
  expect(blankCount).toBeGreaterThan(1);
  for (let i = 0; i < blankCount; i++) {
    // Revealed blanks leave the hidden set, so always click the first.
    await blanks.first().click();
  }
  await page.getByRole("button", { name: "Next round" }).click();
  await expect(page.getByText(/Not quite — you peeked/)).toBeVisible();
  await expect(page.getByText(/Round 2 of 7/)).toBeVisible();
});
