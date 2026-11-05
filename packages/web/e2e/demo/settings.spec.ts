import { expect, test, type Page } from "@playwright/test";

/**
 * Settings (issue #45; Drive sync removed in #96): the gospel-engine
 * API key is local-only state (localStorage `memorize:secrets:v1`,
 * never included in the persisted app data), and at @spudly/ui
 * 5.0.0 the settings page renders only the Scripture source card —
 * the Google Drive sync section is gone entirely (DS #424).
 */

const SECRETS_KEY = "memorize:secrets:v1";
const TEST_KEY = "e2e-test-key-12345";

async function openSettings(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("tab", { name: "Settings" }).click();
  await expect(page.getByText("Scripture source")).toBeVisible();
}

test("saving an API key persists it locally and offers Clear", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await openSettings(page);

  // Signed-out-of-a-key state: no Clear button until a key exists.
  await expect(page.getByRole("button", { name: "Clear key" })).toHaveCount(0);
  await page.getByPlaceholder("gospel-engine API key").fill(TEST_KEY);
  await page.getByRole("button", { name: "Save key", exact: true }).click();
  await expect(page.getByRole("button", { name: "Clear key" })).toBeVisible();

  // Stored under the secrets key (and the Search tab stops claiming the
  // built-in demo set once a key is configured).
  const secrets = await page.evaluate((key) => window.localStorage.getItem(key), SECRETS_KEY);
  expect(secrets).toContain(TEST_KEY);
  await page.getByRole("tab", { name: "Search" }).click();
  await expect(page.getByText("Searching the built-in demo set.")).toHaveCount(0);

  // The key survives a reload.
  await page.reload();
  await page.getByRole("tab", { name: "Settings" }).click();
  await expect(page.getByRole("button", { name: "Clear key" })).toBeVisible();
  await expect(page.getByPlaceholder("gospel-engine API key")).toHaveValue(TEST_KEY);
  expect(errors).toEqual([]);
});

test("clearing the API key removes it from local state", async ({ page }) => {
  await openSettings(page);
  await page.getByPlaceholder("gospel-engine API key").fill(TEST_KEY);
  await page.getByRole("button", { name: "Save key", exact: true }).click();
  await expect(page.getByRole("button", { name: "Clear key" })).toBeVisible();

  await page.getByRole("button", { name: "Clear key" }).click();
  await expect(page.getByRole("button", { name: "Clear key" })).toHaveCount(0);
  await expect(page.getByPlaceholder("gospel-engine API key")).toHaveValue("");

  const secrets = await page.evaluate((key) => window.localStorage.getItem(key), SECRETS_KEY);
  expect(secrets ?? "").not.toContain(TEST_KEY);

  // And it stays cleared after a reload.
  await page.reload();
  await page.getByRole("tab", { name: "Settings" }).click();
  await expect(page.getByRole("button", { name: "Clear key" })).toHaveCount(0);
});

test("the Google Drive sync section no longer renders (#96)", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await openSettings(page);

  await expect(page.getByText("Google Drive sync")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sync with Drive" })).toHaveCount(0);
  expect(errors).toEqual([]);
});
