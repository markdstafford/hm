/**
 * Format an ISO 8601 / RFC 3339 timestamp string into the user's locale-aware
 * date-time form (e.g. "5/25/2026, 4:07:39 PM" in en-US). Returns the input
 * unchanged if it cannot be parsed.
 */
export function formatLocalDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

/** Date-only locale form (e.g. "5/25/2026"). */
export function formatLocalDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString();
}
