import { describe, expect, it } from "vitest";
import { parseLocalDate, compareLocalDates, dateInRelativeWindow, formatLocalDate, toLocalDateString } from "./date";

const NOW = new Date(2026, 4, 27, 12, 0, 0); // May 27 2026, noon

describe("parseLocalDate", () => {
  it("parses YYYY-MM-DD", () => {
    expect(parseLocalDate("2026-05-27")).toEqual({ year: 2026, month: 5, day: 27 });
  });
  it("extracts date part from ISO timestamp", () => {
    expect(parseLocalDate("2026-05-27T10:00:00Z")).toEqual({ year: 2026, month: 5, day: 27 });
  });
  it("returns null for invalid string", () => {
    expect(parseLocalDate("invalid")).toBeNull();
  });
  it("returns null for null/undefined/number", () => {
    expect(parseLocalDate(null)).toBeNull();
    expect(parseLocalDate(undefined)).toBeNull();
    expect(parseLocalDate(123)).toBeNull();
  });
});

describe("formatLocalDate", () => {
  it("formats parts to YYYY-MM-DD string", () => {
    expect(formatLocalDate({ year: 2026, month: 5, day: 27 })).toBe("2026-05-27");
  });
  it("pads month and day", () => {
    expect(formatLocalDate({ year: 2026, month: 1, day: 3 })).toBe("2026-01-03");
  });
});

describe("toLocalDateString", () => {
  it("converts date string to YYYY-MM-DD", () => {
    expect(toLocalDateString("2026-05-27")).toBe("2026-05-27");
  });
  it("converts ISO timestamp to YYYY-MM-DD", () => {
    expect(toLocalDateString("2026-05-27T10:00:00Z")).toBe("2026-05-27");
  });
  it("returns null for invalid input", () => {
    expect(toLocalDateString("invalid")).toBeNull();
    expect(toLocalDateString(null)).toBeNull();
  });
});

describe("compareLocalDates", () => {
  it("returns positive when a > b", () => {
    expect(compareLocalDates("2026-05-27", "2026-05-26")).toBeGreaterThan(0);
  });
  it("returns 0 when equal", () => {
    expect(compareLocalDates("2026-05-27", "2026-05-27")).toBe(0);
  });
  it("returns negative when a < b", () => {
    expect(compareLocalDates("2026-05-26", "2026-05-27")).toBeLessThan(0);
  });
  it("returns null for invalid dates", () => {
    expect(compareLocalDates("invalid", "2026-05-27")).toBeNull();
  });
  it("returns null when both are invalid", () => {
    expect(compareLocalDates("invalid", "also-invalid")).toBeNull();
  });
});

describe("dateInRelativeWindow - today", () => {
  it("includes today", () => {
    expect(dateInRelativeWindow("2026-05-27", "today", NOW)).toBe(true);
  });
  it("excludes yesterday", () => {
    expect(dateInRelativeWindow("2026-05-26", "today", NOW)).toBe(false);
  });
  it("excludes tomorrow", () => {
    expect(dateInRelativeWindow("2026-05-28", "today", NOW)).toBe(false);
  });
});

describe("dateInRelativeWindow - past-week", () => {
  it("includes today (end boundary)", () => {
    expect(dateInRelativeWindow("2026-05-27", "past-week", NOW)).toBe(true);
  });
  it("includes 7 days ago (start boundary)", () => {
    expect(dateInRelativeWindow("2026-05-20", "past-week", NOW)).toBe(true);
  });
  it("excludes 8 days ago", () => {
    expect(dateInRelativeWindow("2026-05-19", "past-week", NOW)).toBe(false);
  });
  it("excludes tomorrow", () => {
    expect(dateInRelativeWindow("2026-05-28", "past-week", NOW)).toBe(false);
  });
});

describe("dateInRelativeWindow - past-month", () => {
  it("includes start boundary (one month ago)", () => {
    expect(dateInRelativeWindow("2026-04-27", "past-month", NOW)).toBe(true);
  });
  it("excludes before start boundary", () => {
    expect(dateInRelativeWindow("2026-04-26", "past-month", NOW)).toBe(false);
  });
  it("includes today", () => {
    expect(dateInRelativeWindow("2026-05-27", "past-month", NOW)).toBe(true);
  });
  it("excludes tomorrow", () => {
    expect(dateInRelativeWindow("2026-05-28", "past-month", NOW)).toBe(false);
  });
});

describe("dateInRelativeWindow - next-week", () => {
  it("includes tomorrow (start boundary)", () => {
    expect(dateInRelativeWindow("2026-05-28", "next-week", NOW)).toBe(true);
  });
  it("includes 7 days from now (end boundary)", () => {
    expect(dateInRelativeWindow("2026-06-03", "next-week", NOW)).toBe(true);
  });
  it("excludes today", () => {
    expect(dateInRelativeWindow("2026-05-27", "next-week", NOW)).toBe(false);
  });
  it("excludes 8 days from now", () => {
    expect(dateInRelativeWindow("2026-06-04", "next-week", NOW)).toBe(false);
  });
});

describe("dateInRelativeWindow - edge cases", () => {
  it("returns false for invalid date value", () => {
    expect(dateInRelativeWindow("invalid", "today", NOW)).toBe(false);
  });
  it("uses current time when now is not provided", () => {
    // Just check it doesn't throw
    expect(() => dateInRelativeWindow("2026-05-27", "today")).not.toThrow();
  });
});
