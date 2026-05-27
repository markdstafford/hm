import { describe, it, expect } from "vitest";
import type { JiraIssueListItem } from "../../bindings";
import type { FilterOption } from "../../views/collection/filter/types";
import { optionsFromItems, labelOptionsFromItems, jiraIssueFilterableProperties } from "./filterable";

const baseItem: JiraIssueListItem = {
  work_item_id: "1",
  key: "AMP-1",
  title: "Test",
  status_name: null,
  assignee_display_name: null,
  updated_at_source: null,
  project_key: null,
  priority_name: null,
  labels: [],
};

describe("jiraIssueFilterableProperties", () => {
  it("has all 8 filterable property ids in correct order", () => {
    expect(jiraIssueFilterableProperties.map((p) => p.property)).toEqual([
      "key",
      "title",
      "status",
      "assignee",
      "updated_at_source",
      "priority",
      "project_key",
      "labels",
    ]);
  });

  it("has correct filter kinds", () => {
    const kinds = Object.fromEntries(
      jiraIssueFilterableProperties.map((p) => [p.property, p.kind]),
    );
    expect(kinds).toEqual({
      key: "text",
      title: "text",
      status: "select",
      assignee: "person",
      updated_at_source: "date",
      priority: "select",
      project_key: "select",
      labels: "multi-select",
    });
  });

  it("getValue returns correct values", () => {
    const item: JiraIssueListItem = {
      work_item_id: "1",
      key: "AMP-1",
      title: "Bug",
      status_name: "Open",
      assignee_display_name: "Alice",
      updated_at_source: "2026-05-01",
      project_key: "AMP",
      priority_name: "High",
      labels: ["frontend", "bug"],
    };
    const getValues = Object.fromEntries(
      jiraIssueFilterableProperties.map((p) => [p.property, p.getValue(item)]),
    );
    expect(getValues).toEqual({
      key: "AMP-1",
      title: "Bug",
      status: "Open",
      assignee: "Alice",
      updated_at_source: "2026-05-01",
      priority: "High",
      project_key: "AMP",
      labels: ["frontend", "bug"],
    });
  });

  it("option provider falls back to item-derived options when optionsByProperty is absent", () => {
    const items = [
      { ...baseItem, status_name: "Open" },
      { ...baseItem, status_name: "Done" },
    ];
    const statusProp = jiraIssueFilterableProperties.find((p) => p.property === "status")!;
    const opts: FilterOption[] = statusProp.options!({ items, optionsByProperty: {} });
    expect(opts.map((o) => o.id)).toEqual(["Done", "Open"]);
  });

  it("option provider uses optionsByProperty when present and non-empty", () => {
    const preloaded: FilterOption[] = [{ id: "In Progress", label: "In Progress" }];
    const statusProp = jiraIssueFilterableProperties.find((p) => p.property === "status")!;
    const opts = statusProp.options!({ items: [], optionsByProperty: { status: preloaded } });
    expect(opts).toEqual(preloaded);
  });
});

describe("optionsFromItems", () => {
  it("returns stable sorted unique non-empty options", () => {
    const items = [
      { ...baseItem, status_name: "Open" },
      { ...baseItem, status_name: "Done" },
      { ...baseItem, status_name: "Open" }, // duplicate
      { ...baseItem, status_name: null }, // excluded
      { ...baseItem, status_name: "" }, // excluded
    ];
    const opts = optionsFromItems(items, "status_name");
    expect(opts.map((o) => o.id)).toEqual(["Done", "Open"]);
  });
});

describe("labelOptionsFromItems", () => {
  it("returns stable sorted unique options from flattened labels", () => {
    const items = [
      { ...baseItem, labels: ["bug", "frontend"] },
      { ...baseItem, labels: ["backend", "bug"] }, // "bug" duplicate
      { ...baseItem, labels: [] },
    ];
    const opts = labelOptionsFromItems(items);
    expect(opts.map((o) => o.id)).toEqual(["backend", "bug", "frontend"]);
  });
});
