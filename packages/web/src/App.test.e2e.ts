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

test(
  "app loads and renders the home UI with no uncaught page errors",
  { tag: "@demo" },
  async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto("/");
    await expect(page.getByText("Memorize", { exact: true })).toBeVisible();
    for (const tab of ["My verses", "Search", "Review", "Settings"]) {
      await expect(page.getByRole("tab", { name: tab })).toBeVisible();
    }
    await expect(page.getByText("No verses yet")).toBeVisible();
    expect(errors).toEqual([]);
  },
);

test(
  "demo mode: searching a demo verse renders its passage",
  { tag: "@demo" },
  async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto("/");
    await searchDemoVerse(page, "Ether 12:27");
    await expect(page.getByText("Ether 12:27", { exact: true })).toBeVisible();
    await expect(page.getByText(/make weak things become strong/)).toBeVisible();
    expect(errors).toEqual([]);
  },
);

test(
  "adding a search result confirms in place with an Added state (#56)",
  { tag: "@demo" },
  async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto("/");
    await searchDemoVerse(page, "Ether 12:27");
    await expect(page.getByText("Ether 12:27", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Add to memorize list" }).click();

    // The confirmation replaces the button in place, without leaving the
    // Search tab: an "Added" button in its disabled state, and no Add
    // button left on the result.
    await expect(page.getByRole("button", { name: "Added" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Added" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Add to memorize list" })).toHaveCount(0);
    expect(errors).toEqual([]);
  },
);

test(
  "a result already in the library shows Added instead of Add (#56)",
  { tag: "@demo" },
  async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto("/");
    await addDemoVerse(page, "Ether 12:27");

    // Re-searching the same verse (e.g. after switching tabs) must show
    // the Added state immediately — the store dedupes the re-add, and
    // the button state is how the user learns that.
    await searchDemoVerse(page, "Ether 12:27");
    await expect(page.getByRole("button", { name: "Added" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add to memorize list" })).toHaveCount(0);
    expect(errors).toEqual([]);
  },
);

test(
  "demo mode: the placeholder's keyword example finds a demo verse",
  { tag: "@demo" },
  async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto("/");
    await page.getByRole("tab", { name: "Search" }).click();
    await expect(page.getByText("Searching the built-in demo set.")).toBeVisible();
    // The demo set contains no "charity" verse (#59): the suggested keyword
    // example must be one the demo set can actually match.
    await expect(page.getByPlaceholder(/Ether 12:27/)).toHaveAttribute("placeholder", /weakness/);
    await searchDemoVerse(page, "weakness");
    await expect(page.getByText("Ether 12:27", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  },
);

test(
  "drill renders blanks and tapping a blank reveals its word",
  { tag: "@demo" },
  async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto("/");
    await addDemoVerse(page, "2 Nephi 2:25");

    await page.getByRole("link", { name: "Drill" }).click();
    await expect(page.getByText(/Round 1 of \d+/)).toBeVisible();
    // Round 1 blanks nothing (BLANK_FRACTIONS starts at 0); round 2 is the
    // first round with hidden words.
    await page.getByRole("button", { name: "Next round" }).click();
    await expect(page.getByText(/Round 2 of \d+/)).toBeVisible();
    // A hidden blank is a button labeled "Reveal blank word N of M"
    // (@spudly/ui BlankWord; the 0.4.x version labeled it with
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
        overlap:
          Math.min(blankRect.bottom, nextRect.bottom) - Math.max(blankRect.top, nextRect.top),
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
  },
);

test(
  "selecting a tab during a drill closes the drill (#100)",
  { tag: "@demo" },
  async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto("/");
    await addDemoVerse(page, "Ether 12:27");

    await page.getByRole("link", { name: "Drill" }).click();
    await expect(page.getByText(/Round 1 of \d+/)).toBeVisible();
    await expect(page).toHaveURL(/\/drill\//);
    // While the drill override shows, no tab is selected.
    for (const tab of ["My verses", "Search", "Review", "Settings"]) {
      await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "false");
    }

    // Selecting a tab is the host's cue to close the drill: the tab's
    // view replaces the drill and the URL returns to the root.
    await page.getByRole("tab", { name: "Review" }).click();
    await expect(page.getByRole("tab", { name: "Review" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByText(/Round 1 of \d+/)).toHaveCount(0);
    await expect(page).toHaveURL(new URL("/", page.url()).href);
    expect(errors).toEqual([]);
  },
);

test(
  "progress persists: the verse list and drill round survive a reload",
  { tag: "@demo" },
  async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto("/");
    await addDemoVerse(page, "Alma 37:35");

    // The verse list is persisted to local storage.
    await page.reload();
    await expect(page.getByText("Alma 37:35", { exact: true })).toBeVisible();

    // Advance one drill round with no peeks (grades as a pass), then reload:
    // the in-progress session resumes at the persisted round.
    await page.getByRole("link", { name: "Drill" }).click();
    await expect(page.getByText(/Round 1 of \d+/)).toBeVisible();
    await page.getByRole("button", { name: "Next round" }).click();
    await expect(page.getByText(/Round 2 of \d+/)).toBeVisible();

    // The drill lives at its canonical /drill/:id route (#96), so a
    // reload reopens the session directly at the persisted round —
    // there is no Drill link to click on the drill page itself.
    await page.reload();
    await expect(page.getByText(/Round 2 of \d+/)).toBeVisible();
    expect(errors).toEqual([]);
  },
);

test.describe("chunk-load failure recovery", () => {
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
  test(
    "a failed lazy-tab chunk shows the frame's reload recovery",
    { tag: "@demo" },
    async ({ page }) => {
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
      // still fails, so restore the chunk, reload, and prove the app —
      // Search included — is fully usable afterwards rather than a
      // blank or still-broken shell.
      await page.getByRole("tab", { name: "Search" }).click();
      await expect(page.getByText("This section failed to load.")).toBeVisible();
      await page.unroute(/SearchTab-[^/]*\.js/);
      await Promise.all([
        page.waitForEvent("load"),
        page.getByRole("button", { name: "Reload the app" }).click(),
      ]);
      await expect(page.getByText("This section failed to load.")).toHaveCount(0);
      await expect(page.getByText("Memorize", { exact: true })).toBeVisible();
      await expect(page.getByRole("tab", { name: "My verses" })).toBeVisible();
      await page.getByRole("tab", { name: "Search" }).click();
      await expect(page.getByText("Searching the built-in demo set.")).toBeVisible();
      await page.getByPlaceholder(/Ether 12:27/).fill("Ether 12:27");
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await expect(page.getByText("Ether 12:27", { exact: true })).toBeVisible();
      expect(errors).toEqual([]);
    },
  );
});
