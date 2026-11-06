import { expect, test, type Page } from "@playwright/test";

/**
 * Settings (issue #45; Drive sync removed in #96; API key removed
 * in #101): at @spudly/ui 6.0.0 the settings page renders no
 * API-key section at all (DS #439) — Memorize search is
 * server-key-only on web and there is no user key on any
 * platform, so there is no key field, Save/Clear key controls, or
 * local secret storage left to exercise. The Google Drive sync
 * section is likewise gone entirely (DS #424).
 */

async function openSettings(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("tab", { name: "Settings" }).click();
  await expect(page.getByRole("tab", { name: "Settings" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
}

test("the API key section no longer renders (#101)", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await openSettings(page);

  await expect(page.getByText("Scripture source")).toHaveCount(0);
  await expect(page.getByPlaceholder("gospel-engine API key")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save key", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Clear key" })).toHaveCount(0);

  // Nothing key-shaped is written to local storage by visiting Settings.
  const storageKeys = await page.evaluate(() => Object.keys(window.localStorage));
  expect(storageKeys).not.toContain("memorize:secrets:v1");
  expect(errors).toEqual([]);
});

test("the Google Drive sync section no longer renders (#96)", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await openSettings(page);

  await expect(page.getByText("Google Drive sync")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sync with Drive" })).toHaveCount(0);
  expect(errors).toEqual([]);
});
