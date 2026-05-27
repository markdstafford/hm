import {
  compareStrings,
  compareDates,
  compareNumbers,
  compareNullLast,
  defaultJiraSort,
  compareNullableStringsNullLast,
  compareJiraIssueByKey,
  compareJiraIssueByTitle,
  compareJiraIssueByStatus,
  compareJiraIssueByAssignee,
  compareJiraIssueByUpdated,
  compareJiraIssueByPriority,
  compareJiraIssueByProjectKey,
} from "./compare";
import { jiraIssueEntity } from ".";
import type { JiraIssueListItem } from "../../bindings";

const makeItem = (overrides: Partial<JiraIssueListItem>): JiraIssueListItem => ({
  work_item_id: "id-1",
  key: "AMP-1",
  title: "Title",
  status_name: null,
  assignee_display_name: null,
  updated_at_source: null,
  project_key: null,
  priority_name: null,
  labels: [],
  ...overrides,
});

describe("compareStrings", () => {
  it("returns negative when a sorts before b", () => {
    expect(compareStrings("apple", "banana")).toBeLessThan(0);
  });
  it("returns positive when a sorts after b", () => {
    expect(compareStrings("banana", "apple")).toBeGreaterThan(0);
  });
  it("returns 0 for equal strings", () => {
    expect(compareStrings("alpha", "alpha")).toBe(0);
  });
  it("is deterministic across calls", () => {
    const r1 = compareStrings("a", "b");
    const r2 = compareStrings("a", "b");
    expect(r1).toBe(r2);
  });
});

describe("compareNumbers", () => {
  it("sorts numerically ascending", () => {
    expect(compareNumbers(1, 10)).toBeLessThan(0);
    expect(compareNumbers(10, 1)).toBeGreaterThan(0);
    expect(compareNumbers(5, 5)).toBe(0);
  });
});

describe("compareDates", () => {
  it("sorts ISO date strings chronologically ascending", () => {
    expect(compareDates("2024-01-01T00:00:00Z", "2024-06-01T00:00:00Z")).toBeLessThan(0);
    expect(compareDates("2024-06-01T00:00:00Z", "2024-01-01T00:00:00Z")).toBeGreaterThan(0);
    expect(compareDates("2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z")).toBe(0);
  });
});

describe("compareNullLast", () => {
  it("places null after non-null", () => {
    const cmp = compareNullLast(compareDates);
    expect(cmp("2024-01-01T00:00:00Z", null)).toBeLessThan(0);
    expect(cmp(null, "2024-01-01T00:00:00Z")).toBeGreaterThan(0);
  });
  it("returns 0 for two nulls", () => {
    const cmp = compareNullLast(compareDates);
    expect(cmp(null, null)).toBe(0);
  });
  it("delegates comparison for two non-null values", () => {
    const cmp = compareNullLast(compareDates);
    expect(cmp("2024-01-01T00:00:00Z", "2024-06-01T00:00:00Z")).toBeLessThan(0);
  });
});

describe("defaultJiraSort", () => {
  it("orders newer updated_at_source before older (descending)", () => {
    const newer = makeItem({ work_item_id: "n", updated_at_source: "2024-06-01T00:00:00Z" });
    const older = makeItem({ work_item_id: "o", updated_at_source: "2024-01-01T00:00:00Z" });
    expect(defaultJiraSort(newer, older)).toBeLessThan(0);
    expect(defaultJiraSort(older, newer)).toBeGreaterThan(0);
  });
  it("places missing updated_at_source last", () => {
    const withDate = makeItem({ work_item_id: "d", updated_at_source: "2024-06-01T00:00:00Z" });
    const nullDate = makeItem({ work_item_id: "n", updated_at_source: null });
    const sorted = [nullDate, withDate].sort(defaultJiraSort);
    expect(sorted[0].work_item_id).toBe("d");
    expect(sorted[1].work_item_id).toBe("n");
  });
  it("is stable for items with equal dates", () => {
    const a = makeItem({ work_item_id: "a", updated_at_source: "2024-01-01T00:00:00Z" });
    const b = makeItem({ work_item_id: "b", updated_at_source: "2024-01-01T00:00:00Z" });
    expect(defaultJiraSort(a, b)).toBe(0);
  });
});

describe("Jira sortable properties", () => {
  it("declares the initial sortable property set and excludes labels", () => {
    expect(jiraIssueEntity.sortableProperties?.map((row) => row.property)).toEqual([
      "key",
      "title",
      "status",
      "assignee",
      "updated_at_source",
      "priority",
      "project_key",
    ]);
  });

  it("sorts strings and places null/empty Jira display values last", () => {
    expect(compareNullableStringsNullLast("Alice", "Bob")).toBeLessThan(0);
    expect(compareNullableStringsNullLast("Bob", "Alice")).toBeGreaterThan(0);
    expect(compareNullableStringsNullLast(null, "Alice")).toBeGreaterThan(0);
    expect(compareNullableStringsNullLast("Alice", null)).toBeLessThan(0);
    expect(compareNullableStringsNullLast(null, null)).toBe(0);

    const alice = makeItem({ assignee_display_name: "Alice" });
    const bob = makeItem({ assignee_display_name: "Bob" });
    const noAssignee = makeItem({ assignee_display_name: null });

    expect(compareJiraIssueByAssignee(alice, bob)).toBeLessThan(0);
    expect(compareJiraIssueByAssignee(bob, alice)).toBeGreaterThan(0);
    expect(compareJiraIssueByAssignee(alice, noAssignee)).toBeLessThan(0);
    expect(compareJiraIssueByAssignee(noAssignee, alice)).toBeGreaterThan(0);
  });

  it("compares every declared Jira sortable property safely", () => {
    const alpha = makeItem({
      work_item_id: "alpha",
      key: "AMP-1",
      title: "Alpha title",
      status_name: "In Progress",
      assignee_display_name: "Alice",
      updated_at_source: "2024-01-01T00:00:00Z",
      priority_name: "High",
      project_key: "AMP",
    });
    const beta = makeItem({
      work_item_id: "beta",
      key: "AMP-2",
      title: "Beta title",
      status_name: "To Do",
      assignee_display_name: "Bob",
      updated_at_source: "2024-06-01T00:00:00Z",
      priority_name: "Low",
      project_key: "BMP",
    });

    expect(compareJiraIssueByKey(alpha, beta)).toBeLessThan(0);
    expect(compareJiraIssueByTitle(alpha, beta)).toBeLessThan(0);
    expect(compareJiraIssueByStatus(alpha, beta)).toBeLessThan(0);
    expect(compareJiraIssueByAssignee(alpha, beta)).toBeLessThan(0);
    expect(compareJiraIssueByUpdated(alpha, beta)).toBeLessThan(0);
    expect(compareJiraIssueByPriority(alpha, beta)).toBeLessThan(0);
    expect(compareJiraIssueByProjectKey(alpha, beta)).toBeLessThan(0);
  });
});
