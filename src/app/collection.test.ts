import { describe, expect, test } from "bun:test";

import {
  formatCollectionCount,
  formatCollectionEntry,
  parsePositiveInteger,
} from "./commands/shared.ts";

describe("parsePositiveInteger", () => {
  test("accepts positive integer text", () => {
    expect(parsePositiveInteger("145365092", "collid")).toBe(145365092);
  });

  test("rejects missing or invalid integer text", () => {
    expect(() => parsePositiveInteger(undefined, "collid")).toThrow(
      "Set collid to a positive integer",
    );
    expect(() => parsePositiveInteger("0", "collid")).toThrow(
      "Set collid to a positive integer",
    );
    expect(() => parsePositiveInteger("abc", "collid")).toThrow(
      "Set collid to a positive integer",
    );
  });
});

describe("formatCollectionEntry", () => {
  test("formats named entries for list output and prompts", () => {
    expect(
      formatCollectionEntry({
        collid: 145365092,
        name: "Captain Sonar",
        objectId: 171131,
        url: "https://boardgamegeek.com/boardgame/171131/captain-sonar",
      }),
    ).toBe("Captain Sonar (#171131, collid 145365092)");
  });
});

describe("formatCollectionCount", () => {
  test("formats the number of fetched collection entries", () => {
    expect(formatCollectionCount(0)).toBe("0 owned collection items");
    expect(formatCollectionCount(1)).toBe("1 owned collection item");
    expect(formatCollectionCount(2)).toBe("2 owned collection items");
  });
});
