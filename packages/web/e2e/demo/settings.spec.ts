import { expect, test, type Page } from "@playwright/test";

/**
 * Settings (issue #45): the gospel-engine API key is local-only state
 * (localStorage `memorize:secrets:v1`, never synced), and the Drive sync
 * section's signed-out state must render and fail gracefully — the e2e
 * build sets no Google OAuth client ID, so a sync attempt reports that
 * instead of opening a sign-in flow (real OAuth is out of CI scope).
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
  await expect(page.getByRole("button", { name: "Clear" })).toHaveCount(0);
  await page.getByPlaceholder("gospel-engine API key").fill(TEST_KEY);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Clear" })).toBeVisible();

  // Stored under the secrets key (and the Search tab stops claiming the
  // built-in demo set once a key is configured).
  const secrets = await page.evaluate((key) => window.localStorage.getItem(key), SECRETS_KEY);
  expect(secrets).toContain(TEST_KEY);
  await page.getByRole("tab", { name: "Search" }).click();
  await expect(page.getByText("Searching the built-in demo set.")).toHaveCount(0);

  // The key survives a reload.
  await page.reload();
  await page.getByRole("tab", { name: "Settings" }).click();
  await expect(page.getByRole("button", { name: "Clear" })).toBeVisible();
  await expect(page.getByPlaceholder("gospel-engine API key")).toHaveValue(TEST_KEY);
  expect(errors).toEqual([]);
});

test("clearing the API key removes it from local state", async ({ page }) => {
  await openSettings(page);
  await page.getByPlaceholder("gospel-engine API key").fill(TEST_KEY);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Clear" })).toBeVisible();

  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.getByRole("button", { name: "Clear" })).toHaveCount(0);
  await expect(page.getByPlaceholder("gospel-engine API key")).toHaveValue("");

  const secrets = await page.evaluate((key) => window.localStorage.getItem(key), SECRETS_KEY);
  expect(secrets ?? "").not.toContain(TEST_KEY);

  // And it stays cleared after a reload.
  await page.reload();
  await page.getByRole("tab", { name: "Settings" }).click();
  await expect(page.getByRole("button", { name: "Clear" })).toHaveCount(0);
});

test("drive sync section renders its signed-out state and fails gracefully", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await openSettings(page);

  await expect(page.getByText("Google Drive sync")).toBeVisible();
  await expect(page.getByText(/memorize-data\.json/)).toBeVisible();
  const syncButton = page.getByRole("button", { name: "Sync with Drive" });
  await expect(syncButton).toBeVisible();
  await expect(syncButton).toBeEnabled();

  // No OAuth client ID is configured in the e2e build, so the attempt
  // must surface that as an in-page message — not a popup, redirect, or
  // crash. (Real Google sign-in is covered by the manual test plan.)
  await syncButton.click();
  await expect(page.getByText(/VITE_GOOGLE_CLIENT_ID is not set/)).toBeVisible();
  expect(errors).toEqual([]);
});
