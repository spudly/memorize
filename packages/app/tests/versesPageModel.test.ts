import type { MemorizedVerse } from "@memorize/types";
import { toMyVersesPageItem, toMyVersesPageItems } from "../src/screens/versesPageModel";

const ENTRY: MemorizedVerse = {
  verse: {
    id: "ether-12-27",
    reference: "Ether 12:27",
    text: "And if men come unto me I will show unto them their weakness.",
  },
  status: "learning",
  addedAt: "2026-10-01T12:00:00.000Z",
  drillRound: 0,
  drillPeeks: 0,
  reviewsCompleted: 0,
};

describe("toMyVersesPageItem", () => {
  it("maps the rendered fields verbatim and carries no others", () => {
    const item = toMyVersesPageItem(ENTRY);
    expect(item).toEqual({
      id: "ether-12-27",
      reference: "Ether 12:27",
      text: "And if men come unto me I will show unto them their weakness.",
      status: "learning",
    });
  });

  it("passes both statuses through as the badge text values", () => {
    expect(toMyVersesPageItem(ENTRY).status).toBe("learning");
    expect(toMyVersesPageItem({ ...ENTRY, status: "memorized" }).status).toBe("memorized");
  });

  it("omits the next-review line when no review is scheduled", () => {
    const item = toMyVersesPageItem(ENTRY);
    expect("nextReviewLabel" in item).toBe(false);
  });

  it("pre-composes the next-review line with the app's locale date format", () => {
    const nextReviewAt = "2026-10-25T12:00:00.000Z";
    const item = toMyVersesPageItem({ ...ENTRY, nextReviewAt });
    expect(item.nextReviewLabel).toBe(
      `Next review: ${new Date(nextReviewAt).toLocaleDateString()}`,
    );
  });
});

describe("toMyVersesPageItems", () => {
  it("maps the list in the app's order", () => {
    const other: MemorizedVerse = {
      ...ENTRY,
      verse: { id: "john-3-16", reference: "John 3:16", text: "For God so loved…" },
      status: "memorized",
    };
    const items = toMyVersesPageItems([ENTRY, other]);
    expect(items.map((i) => i.id)).toEqual(["ether-12-27", "john-3-16"]);
  });

  it("maps an empty list to an empty list (the page's empty state keys off it)", () => {
    expect(toMyVersesPageItems([])).toEqual([]);
  });
});
