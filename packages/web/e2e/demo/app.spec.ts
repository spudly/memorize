import { expect, test, type Page } from "@playwright/test";

/** Collect uncaught page errors so a spec can assert there were none. */
function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  return errors;
}

async function searchDemoVerse(page: Page, query: string): Promise<void> {
  await page.getByRole("tab", { name: "Search" }).click();
  await expect(page.getByText("Searching the built-in demo set.")).toBeVisible();
  await page.getByPlaceholder(/Ether 12:27/).fill(query);
  await page.getByRole("button", { name: "Search", exact: true }).click();
}

async function addDemoVerse(page: Page, reference: string): Promise<void> {
  await searchDemoVerse(page, reference);
  await expect(page.getByText(reference, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add to memorize list" }).click();
  await page.getByRole("tab", { name: "My verses" }).click();
  await expect(page.getByText(reference, { exact: true })).toBeVisible();
}

test("app loads and renders the home UI with no uncaught page errors", async ({ page }) => {
  const errors = trackPageErrors(page);
  await page.goto("/");
  await expect(page.getByText("Memorize", { exact: true })).toBeVisible();
  for (const tab of ["My verses", "Search", "Review", "Settings"]) {
    await expect(page.getByRole("tab", { name: tab })).toBeVisible();
  }
  await expect(page.getByText("No verses yet")).toBeVisible();
  expect(errors).toEqual([]);
});

test("demo mode: searching a demo verse renders its passage", async ({ page }) => {
  const errors = trackPageErrors(page);
  await page.goto("/");
  await searchDemoVerse(page, "Ether 12:27");
  await expect(page.getByText("Ether 12:27", { exact: true })).toBeVisible();
  await expect(page.getByText(/make weak things become strong/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("drill renders blanks and tapping a blank reveals its word", async ({ page }) => {
  const errors = trackPageErrors(page);
  await page.goto("/");
  await addDemoVerse(page, "2 Nephi 2:25");

  await page.getByRole("button", { name: "Drill" }).click();
  await expect(page.getByText(/Round 1 of \d+/)).toBeVisible();
  // Round 1 blanks nothing (BLANK_FRACTIONS starts at 0); round 2 is the
  // first round with hidden words.
  await page.getByRole("button", { name: "Next round" }).click();
  await expect(page.getByText(/Round 2 of \d+/)).toBeVisible();
  // A hidden blank is a button labeled "Reveal blank word N of M"
  // (@spudly/ui 1.x BlankWord; the 0.4.x version labeled it with
  // underscores). On web the DS currently emits that label as an
  // `accessibilitylabel` attribute instead of `aria-label`
  // (spudly/design-system#235), so match both spellings.
  const blanks = page.locator(
    'button[aria-label^="Reveal blank word"], button[accessibilitylabel^="Reveal blank word"]',
  );
  const blankCount = await blanks.count();
  expect(blankCount).toBeGreaterThan(0);

  // Layout guard for the inline flow itself (spudly/design-system#225):
  // counting blanks cannot distinguish inline blanks from the old
  // block-stacked ones. A hidden blank must sit on the same line as the
  // word after it, narrower than the verse, with a visible gap before
  // that word (the separator after each blank).
  const layout = await page.evaluate(() => {
    const blank = document.querySelector(
      'button[aria-label^="Reveal blank word"], button[accessibilitylabel^="Reveal blank word"]',
    );
    if (!blank) return null;
    // The verse container is the blank's closest ancestor holding the
    // whole verse (several words), whatever wrappers sit in between —
    // the blank is not a direct sibling of the word elements.
    let container: Element | null = blank.parentElement;
    while (container && (container.textContent ?? "").trim().split(/\s+/).length < 5) {
      container = container.parentElement;
    }
    if (!container) return null;
    const blankRect = blank.getBoundingClientRect();
    // The word after the blank is the next text node outside the blank
    // with real content; measure it with a range so element nesting
    // doesn't matter.
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node: Node | null = null;
    let pastBlank = false;
    let nextRect: DOMRect | null = null;
    while ((node = walker.nextNode())) {
      if (blank.contains(node)) {
        pastBlank = true;
        continue;
      }
      if (!pastBlank || !(node.textContent ?? "").trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      nextRect = range.getBoundingClientRect();
      break;
    }
    if (!nextRect) return null;
    return {
      blankWidth: blankRect.width,
      containerWidth: container.getBoundingClientRect().width,
      overlap: Math.min(blankRect.bottom, nextRect.bottom) - Math.max(blankRect.top, nextRect.top),
      gap: nextRect.left - blankRect.right,
    };
  });
  expect(layout).not.toBeNull();
  if (!layout) throw new Error("blank layout probe found no following word");
  expect(layout.overlap).toBeGreaterThan(0);
  expect(layout.gap).toBeGreaterThan(0);
  expect(layout.blankWidth).toBeLessThan(layout.containerWidth / 2);

  // The web drill's input is tap-to-peek: revealing a blank takes it out
  // of the set of hidden blanks.
  await blanks.first().click();
  await expect(blanks).toHaveCount(blankCount - 1);
  expect(errors).toEqual([]);
});

test("progress persists: the verse list and drill round survive a reload", async ({ page }) => {
  const errors = trackPageErrors(page);
  await page.goto("/");
  await addDemoVerse(page, "Alma 37:35");

  // The verse list is persisted to local storage.
  await page.reload();
  await expect(page.getByText("Alma 37:35", { exact: true })).toBeVisible();

  // Advance one drill round with no peeks (grades as a pass), then reload:
  // the in-progress session resumes at the persisted round.
  await page.getByRole("button", { name: "Drill" }).click();
  await expect(page.getByText(/Round 1 of \d+/)).toBeVisible();
  await page.getByRole("button", { name: "Next round" }).click();
  await expect(page.getByText(/Round 2 of \d+/)).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Drill" }).click();
  await expect(page.getByText(/Round 2 of \d+/)).toBeVisible();
  expect(errors).toEqual([]);
});
