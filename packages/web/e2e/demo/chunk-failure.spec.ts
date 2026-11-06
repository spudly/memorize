import { expect, test } from "@playwright/test";

/**
 * Chunk-load failure recovery (#100): the app shell is the DS
 * TabbedShellPage frame, whose internal lazy slot wraps each tab's
 * content in the design system's chunk-error boundary. When a lazy
 * tab's chunk fails to load (a stale deploy served to an open tab is
 * the real-world case), the surface must show the boundary's
 * full-reload recovery — an error alert plus "Reload the app" —
 * while the shell's tab bar stays usable, and switching surfaces
 * clears the failure. The failure is forced by aborting the
 * SearchTab chunk request; everything else loads normally.
 */
test("a failed lazy-tab chunk shows the frame's reload recovery", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  await page.route(/SearchTab-[^/]*\.js/, (route) => route.abort());
  await page.goto("/");

  await page.getByRole("tab", { name: "Search" }).click();
  await expect(page.getByText("This section failed to load.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reload the app" })).toBeVisible();

  // The tab bar stays usable and switching surfaces clears the
  // failure (the slot is keyed by the active surface).
  await page.getByRole("tab", { name: "My verses" }).click();
  await expect(page.getByText("No verses yet")).toBeVisible();
  await expect(page.getByText("This section failed to load.")).toHaveCount(0);

  // The recovery action is a full reload: back on Search the chunk
  // still fails, the app shell itself reloads cleanly, and the
  // fallback is offered again rather than a blank screen.
  await page.getByRole("tab", { name: "Search" }).click();
  await expect(page.getByText("This section failed to load.")).toBeVisible();
  await Promise.all([
    page.waitForEvent("load"),
    page.getByRole("button", { name: "Reload the app" }).click(),
  ]);
  await expect(page.getByText("This section failed to load.")).toHaveCount(0);
  await expect(page.getByText("Memorize", { exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "My verses" })).toBeVisible();
  expect(errors).toEqual([]);
});
