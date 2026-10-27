import { expect, test, type Page } from "@playwright/test";

/**
 * Adding verses found through the engine proxy (issue #45):
 * search.spec.ts pins that proxy results render; these specs pin that a
 * proxy result can be added to the library and persists — the add path
 * the My Verses list and drill/review flows all start from. Fixtures use
 * the documented gospel-engine shapes (packages/core/docs/api-notes.md).
 */

const GET_ETHER_12_27 = {
  reference_query: "Ether 12:27",
  source_type: "scriptures",
  verses: [
    {
      id: 4360,
      volume: "bofm",
      book: "ether",
      chapter: 12,
      verse: 27,
      reference: "Ether 12:27",
      text: "And if men come unto me I willshow unto them their weakness. I give unto men weakness that they may be humble; and my grace is sufficient for all men that humble themselves before me; for if they humble themselves before me, and havefaith in me, then will I make weak things become strong unto them.",
      file_path: "/data/gospel-library/eng/scriptures/bofm/ether/12.md",
    },
  ],
};

async function mockUnmockedApi(page: Page): Promise<void> {
  await page.route("**/api/**", async (route) => {
    await route.fulfill({ status: 404, json: { error: "not mocked in e2e" } });
  });
}

test("a verse found via the proxy can be added to the library and persists", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await mockUnmockedApi(page);
  await page.route("**/api/get**", async (route) => {
    await route.fulfill({ json: GET_ETHER_12_27 });
  });
  await page.goto("/");

  await page.getByRole("tab", { name: "Search" }).click();
  await page.getByPlaceholder(/Ether 12:27/).fill("Ether 12:27");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("Ether 12:27", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add to memorize list" }).click();

  await page.getByRole("tab", { name: "My verses" }).click();
  await expect(page.getByText("Ether 12:27", { exact: true })).toBeVisible();
  await expect(page.getByText(/willshow unto them their weakness/)).toBeVisible();
  await expect(page.getByText("learning", { exact: true })).toBeVisible();

  // The add is persisted to local storage, so it survives a reload.
  await page.reload();
  await expect(page.getByText("Ether 12:27", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
