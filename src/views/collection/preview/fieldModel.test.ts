import { describe, expect, it } from "vitest";
import type { PreviewFieldConfig, PreviewFieldDefinition, PreviewFieldSourceConfig } from "../types";
import {
  genericPreviewFieldIsEmpty,
  normalizePreviewFieldConfig,
  partitionPreviewFields,
  resolvePreviewFieldConfig,
} from "./fieldModel";

type Property = "title" | "priority" | "labels" | "count" | "flag" | "team";
type Item = {
  title?: string | null;
  priority?: string | null;
  labels?: string[] | null;
  count?: number | null;
  flag?: boolean | null;
  team?: string | null;
};

const definitions: PreviewFieldDefinition<Item, Property>[] = [
  { property: "title", label: "Title", isEmpty: (item) => genericPreviewFieldIsEmpty(item.title) },
  { property: "priority", label: "Priority", isEmpty: (item) => genericPreviewFieldIsEmpty(item.priority) },
  { property: "labels", label: "Labels", isEmpty: (item) => genericPreviewFieldIsEmpty(item.labels) },
  { property: "count", label: "Count", isEmpty: (item) => genericPreviewFieldIsEmpty(item.count) },
  { property: "flag", label: "Flag", isEmpty: (item) => genericPreviewFieldIsEmpty(item.flag) },
  { property: "team", label: "Team", isEmpty: (item) => genericPreviewFieldIsEmpty(item.team), pinEligible: true },
];

const defaults: PreviewFieldConfig<Property>[] = [
  { property: "priority", tier: 1 },
  { property: "labels", tier: 2 },
  { property: "count", tier: 3 },
];

describe("genericPreviewFieldIsEmpty", () => {
  it.each([
    [null, true],
    [undefined, true],
    ["", true],
    ["   ", true],
    [[], true],
    [["bug"], false],
    [0, false],
    [false, false],
    ["P1", false],
  ])("treats %j empty as %s", (value, expected) => {
    expect(genericPreviewFieldIsEmpty(value)).toBe(expected);
  });
});

describe("normalizePreviewFieldConfig", () => {
  it("drops unknown properties, preserves valid override order, appends missing defaults, and coerces invalid tiers", () => {
    const sourceConfig = [
      { property: "team", tier: 3, pinned: true },
      { property: "missing", tier: 1 },
      { property: "labels", tier: 9 },
    ] as unknown as PreviewFieldConfig<Property>[];

    expect(normalizePreviewFieldConfig(definitions, defaults, sourceConfig)).toEqual([
      { property: "team", tier: 3, pinned: true },
      { property: "labels", tier: 2 },
      { property: "priority", tier: 1 },
      { property: "count", tier: 3 },
    ]);
  });

  it("uses defaults when no source config exists", () => {
    expect(normalizePreviewFieldConfig(definitions, defaults)).toEqual(defaults);
  });
});

describe("resolvePreviewFieldConfig", () => {
  it("returns defaults when the versioned source config has no match", () => {
    const sourceConfigs: PreviewFieldSourceConfig<Property>[] = [
      { sourceId: "jira-other", entityId: "jira-issue", fields: [{ property: "team", tier: 1 }] },
      { sourceId: "jira-main", entityId: "github-issue", fields: [{ property: "team", tier: 1 }] },
    ];

    expect(resolvePreviewFieldConfig({ definitions, defaults, sourceConfigs, entityId: "jira-issue", sourceId: "jira-main" })).toEqual(defaults);
  });

  it("normalizes the matching entity/source override", () => {
    const sourceConfigs: PreviewFieldSourceConfig<Property>[] = [
      { sourceId: "jira-main", entityId: "jira-issue", fields: [{ property: "team", tier: 2, pinned: true }] },
    ];

    expect(resolvePreviewFieldConfig({ definitions, defaults, sourceConfigs, entityId: "jira-issue", sourceId: "jira-main" })).toEqual([
      { property: "team", tier: 2, pinned: true },
      { property: "priority", tier: 1 },
      { property: "labels", tier: 2 },
      { property: "count", tier: 3 },
    ]);
  });
});

describe("partitionPreviewFields", () => {
  it("omits empty fields, promotes pinned fields to tier 1, and keeps tier 2/3 together as secondary", () => {
    const item: Item = {
      priority: "P1",
      labels: ["ui"],
      count: 0,
      flag: false,
      team: "Platform",
      title: "  ",
    };
    const config: PreviewFieldConfig<Property>[] = [
      { property: "title", tier: 1 },
      { property: "priority", tier: 1 },
      { property: "labels", tier: 2 },
      { property: "count", tier: 3 },
      { property: "flag", tier: 2 },
      { property: "team", tier: 2, pinned: true },
    ];

    const result = partitionPreviewFields(item, definitions, config);

    expect(result.tierOne.map((field) => field.definition.property)).toEqual(["priority", "team"]);
    expect(result.tierOne.map((field) => field.effectiveTier)).toEqual([1, 1]);
    expect(result.tierOne[1].pinned).toBe(true);
    expect(result.secondary.map((field) => field.definition.property)).toEqual(["labels", "count", "flag"]);
    expect(result.hiddenEmpty.map((field) => field.definition.property)).toEqual(["title"]);
  });
});
