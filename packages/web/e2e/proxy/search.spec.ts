import { expect, test, type Page } from "@playwright/test";

/**
 * Fixture-mocked gospel-engine flows (issue #30). The proxy build calls
 * /api/* on its own origin; these specs intercept the requests in the
 * browser and fulfill them with the documented response shapes
 * (packages/core/docs/api-notes.md), so CI pins the field mapping the app
 * relies on — reference/text inside the /api/get `verses` envelope, and
 * reference/text inside the /api/search `results` array (the /api/search
 * shape is still unverified against the live engine; if it differs, this
 * spec is the tripwire that says so).
 */

// Verbatim /api/get shape captured from the live API on 2026-10-16 (the
// same sample pinned in packages/core/tests/scripture.test.ts), narrowed
// to the single verse the spec asks for.
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

const SEARCH_CHARITY = {
  results: [
    {
      reference: "Moroni 7:47",
      text: "But charity is the pure love of Christ, and it endureth forever.",
    },
  ],
};

/**
 * Catch-all for /api/*, registered BEFORE the per-test fixture routes
 * (Playwright matches routes in reverse registration order, so the
 * specific fixtures win). Anything unmocked gets a deterministic 404
 * instead of falling through to the vite preview proxy and the live
 * engine — e.g. the /api/search fallback a failed /api/get lookup takes.
 */
async function mockUnmockedApi(page: Page): Promise<void> {
  await page.route("**/api/**", async (route) => {
    await route.fulfill({ status: 404, json: { error: "not mocked in e2e" } });
  });
}

async function search(page: Page, query: string): Promise<void> {
  await page.getByRole("tab", { name: "Search" }).click();
  await page.getByPlaceholder(/Ether 12:27/).fill(query);
  await page.getByRole("button", { name: "Search", exact: true }).click();
}

test("reference search renders the passage from the /api/get fixture", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await mockUnmockedApi(page);
  const getRequests: string[] = [];
  await page.route("**/api/get**", async (route) => {
    getRequests.push(route.request().url());
    await route.fulfill({ json: GET_ETHER_12_27 });
  });
  await page.goto("/");
  await search(page, "Ether 12:27");
  await expect(page.getByText("Ether 12:27", { exact: true })).toBeVisible();
  // "willshow" is an upstream typo in the captured fixture text; the
  // built-in demo verse has "will show". Seeing the typo proves the
  // rendered text came through the intercepted /api/get mapping, not
  // from demo data.
  await expect(page.getByText(/willshow unto them their weakness/)).toBeVisible();
  await expect(page.getByText(/make weak things become strong/)).toBeVisible();
  expect(getRequests).toHaveLength(1);
  expect(getRequests[0]).toContain(`ref=${encodeURIComponent("Ether 12:27")}`);
  expect(errors).toEqual([]);
});

test("keyword search renders results from the /api/search fixture", async ({ page }) => {
  await mockUnmockedApi(page);
  const searchRequests: string[] = [];
  await page.route("**/api/search**", async (route) => {
    searchRequests.push(route.request().url());
    await route.fulfill({ json: SEARCH_CHARITY });
  });
  await page.goto("/");
  await search(page, "charity");
  await expect(page.getByText("Moroni 7:47", { exact: true })).toBeVisible();
  await expect(page.getByText(/pure love of Christ/)).toBeVisible();
  expect(searchRequests).toHaveLength(1);
  expect(searchRequests[0]).toContain("q=charity");
});
