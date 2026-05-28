import type { RelativeDateValue } from "./types";

export type LocalDateParts = { year: number; month: number; day: number };

/** Parse "YYYY-MM-DD" or ISO timestamp to LocalDateParts. Returns null for invalid. */
export function parseLocalDate(value: unknown): LocalDateParts | null {
  if (typeof value !== "string") return null;

  // Extract date part from ISO timestamp or plain date string
  const datePart = value.slice(0, 10);

  // Match YYYY-MM-DD exactly
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  // Basic range validation
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  return { year, month, day };
}

/** Format LocalDateParts back to "YYYY-MM-DD" string. */
export function formatLocalDate(parts: LocalDateParts): string {
  const y = String(parts.year).padStart(4, "0");
  const m = String(parts.month).padStart(2, "0");
  const d = String(parts.day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Convert a value (string timestamp or date string) to "YYYY-MM-DD" string or null. */
export function toLocalDateString(value: unknown): string | null {
  const parts = parseLocalDate(value);
  if (!parts) return null;
  return formatLocalDate(parts);
}

/**
 * Compare two date values as local calendar dates.
 * Returns negative if a < b, 0 if equal, positive if a > b.
 * Returns null if either value can't be parsed.
 */
export function compareLocalDates(a: unknown, b: unknown): number | null {
  const pa = parseLocalDate(a);
  const pb = parseLocalDate(b);

  if (!pa || !pb) return null;

  if (pa.year !== pb.year) return pa.year - pb.year;
  if (pa.month !== pb.month) return pa.month - pb.month;
  return pa.day - pb.day;
}

/**
 * Returns the LocalDateParts for the given Date object.
 */
function dateToLocalParts(d: Date): LocalDateParts {
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

/**
 * Compare LocalDateParts directly.
 * Returns negative if a < b, 0 if equal, positive if a > b.
 */
function compareParts(a: LocalDateParts, b: LocalDateParts): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

/**
 * Returns true if value is within the given relative window from `now`.
 * Uses local calendar boundaries.
 */
export function dateInRelativeWindow(
  value: unknown,
  window: RelativeDateValue,
  now: Date = new Date(),
): boolean {
  const valueParts = parseLocalDate(value);
  if (!valueParts) return false;

  const todayParts = dateToLocalParts(now);

  switch (window) {
    case "today": {
      return compareParts(valueParts, todayParts) === 0;
    }

    case "past-week": {
      // From 7 days ago inclusive through today inclusive
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      const startParts = dateToLocalParts(startDate);
      return compareParts(valueParts, startParts) >= 0 && compareParts(valueParts, todayParts) <= 0;
    }

    case "past-month": {
      // From one calendar month ago inclusive through today inclusive
      const startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      const startParts = dateToLocalParts(startDate);
      return compareParts(valueParts, startParts) >= 0 && compareParts(valueParts, todayParts) <= 0;
    }

    case "next-week": {
      // From tomorrow through 7 days from now inclusive
      const startDate = new Date(now);
      startDate.setDate(now.getDate() + 1);
      const endDate = new Date(now);
      endDate.setDate(now.getDate() + 7);
      const startParts = dateToLocalParts(startDate);
      const endParts = dateToLocalParts(endDate);
      return compareParts(valueParts, startParts) >= 0 && compareParts(valueParts, endParts) <= 0;
    }
  }
}
