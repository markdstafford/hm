import { describe, it, expect } from "vitest";
import { jiraIssueEntity } from ".";
import {
  bucketUpdatedAtSource,
  updatedAtBucketOrder,
} from "./properties";

describe("Jira issue grouping metadata", () => {
  it("declares only the approved groupable properties", () => {
    expect(jiraIssueEntity.groupableProperties?.map((row) => row.property)).toEqual([
      "status",
      "assignee",
      "priority",
      "project_key",
      "updated_at_source",
    ]);
  });

  it("does not group free-form or multi-value fields", () => {
    const grouped = new Set(jiraIssueEntity.groupableProperties?.map((row) => row.property));
    expect(grouped.has("key")).toBe(false);
    expect(grouped.has("title")).toBe(false);
    expect(grouped.has("labels")).toBe(false);
  });
});

describe("bucketUpdatedAtSource", () => {
  const now = new Date("2026-05-27T12:00:00");

  it.each([
    ["2026-05-27T08:00:00", "today"],
    ["2026-05-26T08:00:00", "yesterday"],
    ["2026-05-25T08:00:00", "this-week"],
    ["2026-05-10T08:00:00", "this-month"],
    ["2026-04-30T08:00:00", "older"],
    [null, "no-updated-date"],
    ["not-a-date", "no-updated-date"],
  ])("maps %s to %s", (value, bucket) => {
    expect(bucketUpdatedAtSource(value, now)).toBe(bucket);
  });

  it("orders date freshness buckets from recent to oldest with missing last", () => {
    expect(updatedAtBucketOrder().map((bucket) => bucket.label)).toEqual([
      "Today",
      "Yesterday",
      "This week",
      "This month",
      "Older",
      "No updated date",
    ]);
  });
});
