import { describe, it, expect } from "vitest";
import { jiraIssueEntity } from "../../entities/jira-issue";
import {
  addSortLevel,
  availableSortProperties,
  clearSort,
  defaultViewConfig,
  moveSortLevel,
  normalizeViewConfig,
  removeSortLevel,
  setSortProperty,
  toggleSortDirection,
  patchViewConfig,
  setPropertyVisible,
  setPropertySide,
  moveProperty,
  applyPropertyDrop,
  summarizeViewConfig,
} from "./ViewConfig";

describe("defaultViewConfig", () => {
  it("builds full config from entity", () => {
    const config = defaultViewConfig(jiraIssueEntity);

    expect(config.layout).toEqual({ type: "table", density: "regular", preview: "side-peek" });
    expect(config.sort).toEqual([]);
    expect(config.group).toEqual({ property: null, hideEmptyGroups: true });
    expect(config.filters).toEqual([]);
    expect(config.conditionalColor).toEqual({ enabled: false, rules: [] });

    // propertyVisibility matches entity.defaultProperties
    expect(config.propertyVisibility).toHaveLength(jiraIssueEntity.defaultProperties.length);
    expect(config.propertyVisibility).toEqual(
      jiraIssueEntity.defaultProperties.map((p) => ({
        property: p.property,
        side: p.side,
        visible: p.visible,
      }))
    );
  });

  it("returns a fresh copy (doesn't reference entity.defaultProperties directly)", () => {
    const config = defaultViewConfig(jiraIssueEntity);
    expect(config.propertyVisibility).not.toBe(jiraIssueEntity.defaultProperties);
  });
});

describe("normalizeViewConfig", () => {
  it("normalizes {} to defaults", () => {
    const result = normalizeViewConfig({}, jiraIssueEntity);
    expect(result).toEqual(defaultViewConfig(jiraIssueEntity));
  });

  it("normalizes null to defaults", () => {
    const result = normalizeViewConfig(null, jiraIssueEntity);
    expect(result).toEqual(defaultViewConfig(jiraIssueEntity));
  });

  it("normalizes a non-object string to defaults", () => {
    const result = normalizeViewConfig("not-json-object", jiraIssueEntity);
    expect(result).toEqual(defaultViewConfig(jiraIssueEntity));
  });

  it("preserves valid partial config", () => {
    const input = {
      layout: { density: "compact" },
      sort: [{ property: "updated_at_source", direction: "desc" }],
    };
    const result = normalizeViewConfig(input, jiraIssueEntity);

    expect(result.layout.density).toBe("compact");
    expect(result.layout.type).toBe("table");
    expect(result.layout.preview).toBe("side-peek");
    expect(result.sort).toEqual([{ property: "updated_at_source", direction: "desc" }]);
    // Other fields should be defaults
    expect(result.propertyVisibility).toEqual(defaultViewConfig(jiraIssueEntity).propertyVisibility);
    expect(result.group).toEqual({ property: null, hideEmptyGroups: true });
    expect(result.filters).toEqual([]);
    expect(result.conditionalColor).toEqual({ enabled: false, rules: [] });
  });

  it("drops invalid fields and falls back to defaults", () => {
    const input = {
      layout: { density: "tiny" },
      sort: [{ property: 123, direction: "desc" }],
    };
    const result = normalizeViewConfig(input, jiraIssueEntity);

    expect(result.layout.density).toBe("regular"); // invalid density → default
    expect(result.sort).toEqual([]); // invalid sort row → dropped
  });

  it("keeps only valid propertyVisibility rows", () => {
    const input = {
      propertyVisibility: [
        { property: "key", side: "left", visible: true },
        { property: 123, side: "left", visible: true }, // invalid property type
        { property: "status", side: "invalid-side", visible: true }, // invalid side -> falls back to default side
      ],
    };
    const result = normalizeViewConfig(input, jiraIssueEntity);
    // key appears first (from input), status appears at its input position but with fixed side,
    // the rest are appended in entity definition order
    expect(result.propertyVisibility.find((row) => row.property === "key")).toEqual({ property: "key", side: "left", visible: true });
    // status gets default side since "invalid-side" is invalid
    expect(result.propertyVisibility.find((row) => row.property === "status")).toEqual({ property: "status", side: "right", visible: true });
    // The row with property: 123 is dropped
    expect(result.propertyVisibility.find((row) => (row as any).property === undefined)).toBeUndefined();
    expect(result.propertyVisibility).toHaveLength(8); // all 8 jira properties
  });

  it("falls back to default propertyVisibility when no valid rows", () => {
    const input = {
      propertyVisibility: [
        { property: 123, side: "left", visible: true },
      ],
    };
    const result = normalizeViewConfig(input, jiraIssueEntity);
    expect(result.propertyVisibility).toEqual(defaultViewConfig(jiraIssueEntity).propertyVisibility);
  });

  it("normalizes valid filters", () => {
    const input = {
      filters: [
        { id: "f1", property: "status", operator: "eq", value: "In Progress", active: true },
        { id: 123, property: "status", operator: "eq", value: null, active: false }, // invalid id
      ],
    };
    const result = normalizeViewConfig(input, jiraIssueEntity);
    expect(result.filters).toEqual([
      { id: "f1", property: "status", operator: "eq", value: "In Progress", active: true },
    ]);
  });

  it("normalizes valid group config", () => {
    const input = {
      group: { property: "status", hideEmptyGroups: false },
    };
    const result = normalizeViewConfig(input, jiraIssueEntity);
    expect(result.group).toEqual({ property: "status", hideEmptyGroups: false });
  });

  it("always returns conditionalColor as disabled", () => {
    const input = { conditionalColor: { enabled: true, rules: [{ foo: "bar" }] } };
    const result = normalizeViewConfig(input, jiraIssueEntity);
    expect(result.conditionalColor).toEqual({ enabled: false, rules: [] });
  });

  it("normalizes invalid layout type and preview values back to defaults", () => {
    const config = normalizeViewConfig(
      {
        layout: {
          type: "board",
          density: "dense",
          preview: "drawer",
        },
      },
      jiraIssueEntity,
    );

    expect(config.layout).toEqual({
      type: "table",
      density: "regular",
      preview: "side-peek",
    });
  });
});

describe("summarizeViewConfig", () => {
  it("summarizes default config correctly", () => {
    const summary = summarizeViewConfig(defaultViewConfig(jiraIssueEntity), jiraIssueEntity);
    expect(summary.layout).toBe("Table · Regular");
    expect(summary.propertyVisibility).toBe("5 of 8");
    expect(summary.sort).toBe("None");
    expect(summary.group).toBe("None");
    expect(summary.filter).toBe("None");
    expect(summary.conditionalColor).toBe("Soon");
  });

  it("shows sort with property label and direction arrow", () => {
    const config = {
      ...defaultViewConfig(jiraIssueEntity),
      sort: [{ property: "updated_at_source", direction: "desc" as const }],
    };
    const summary = summarizeViewConfig(config, jiraIssueEntity);
    expect(summary.sort).toBe("Updated ↓");
  });

  it("shows ascending arrow for asc direction", () => {
    const config = {
      ...defaultViewConfig(jiraIssueEntity),
      sort: [{ property: "key", direction: "asc" as const }],
    };
    const summary = summarizeViewConfig(config, jiraIssueEntity);
    expect(summary.sort).toBe("Key ↑");
  });

  it("shows group property label", () => {
    const config = {
      ...defaultViewConfig(jiraIssueEntity),
      group: { property: "status", hideEmptyGroups: true },
    };
    const summary = summarizeViewConfig(config, jiraIssueEntity);
    expect(summary.group).toBe("Status");
  });

  it("shows active filter count", () => {
    const config = {
      ...defaultViewConfig(jiraIssueEntity),
      filters: [
        { id: "f1", property: "status", operator: "eq", value: "In Progress", active: true },
        { id: "f2", property: "assignee", operator: "eq", value: "Bob", active: false },
      ],
    };
    const summary = summarizeViewConfig(config, jiraIssueEntity);
    expect(summary.filter).toBe("1 active");
  });

  it("shows compact density label", () => {
    const config = {
      ...defaultViewConfig(jiraIssueEntity),
      layout: { type: "table" as const, density: "compact" as const, preview: "side-peek" as const },
    };
    const summary = summarizeViewConfig(config, jiraIssueEntity);
    expect(summary.layout).toBe("Table · Compact");
  });

  it("uses property id as fallback label for unknown property", () => {
    const config = {
      ...defaultViewConfig(jiraIssueEntity),
      sort: [{ property: "unknown_prop", direction: "asc" as const }],
    };
    const summary = summarizeViewConfig(config, jiraIssueEntity);
    expect(summary.sort).toBe("unknown_prop ↑");
  });
});

describe("patchViewConfig", () => {
  it("does not mutate the original config", () => {
    const original = defaultViewConfig(jiraIssueEntity);
    const originalLayout = { ...original.layout };
    const originalSort = [...original.sort];

    const patched = patchViewConfig(original, {
      layout: { type: "table", density: "compact", preview: "side-peek" },
      sort: [{ property: "key", direction: "asc" }],
    });

    // Original unchanged
    expect(original.layout).toEqual(originalLayout);
    expect(original.sort).toEqual(originalSort);

    // Patched has new values
    expect(patched.layout.density).toBe("compact");
    expect(patched.sort).toEqual([{ property: "key", direction: "asc" }]);
  });

  it("merges layout fields without replacing unspecified fields", () => {
    const original = defaultViewConfig(jiraIssueEntity);
    const patched = patchViewConfig(original, {
      layout: { type: "table", density: "compact", preview: "full-page" },
    });
    expect(patched.layout.type).toBe("table");
    expect(patched.layout.density).toBe("compact");
    expect(patched.layout.preview).toBe("full-page");
  });

  it("merges group fields", () => {
    const original = defaultViewConfig(jiraIssueEntity);
    const patched = patchViewConfig(original, {
      group: { property: "status", hideEmptyGroups: false },
    });
    expect(patched.group.property).toBe("status");
    expect(patched.group.hideEmptyGroups).toBe(false);
  });

  it("always returns conditionalColor as disabled regardless of patch", () => {
    const original = defaultViewConfig(jiraIssueEntity);
    const patched = patchViewConfig(original, {
      conditionalColor: { enabled: false, rules: [] },
    });
    expect(patched.conditionalColor).toEqual({ enabled: false, rules: [] });
  });

  it("copies arrays shallowly", () => {
    const original = defaultViewConfig(jiraIssueEntity);
    const newFilters = [
      { id: "f1", property: "status", operator: "eq", value: "Done", active: true },
    ];
    const patched = patchViewConfig(original, { filters: newFilters });
    expect(patched.filters).toEqual(newFilters);
    expect(patched.filters).not.toBe(newFilters); // different reference (copy)
  });

  it("patches only layout fields and preserves sort, group, and filters", () => {
    const base = normalizeViewConfig(
      {
        layout: { type: "table", density: "regular", preview: "side-peek" },
        sort: [{ property: "rank", direction: "desc" }],
        group: { property: "name", hideEmptyGroups: false },
        filters: [
          { id: "filter-1", property: "name", operator: "contains", value: "A", active: true },
        ],
      },
      jiraIssueEntity,
    );

    const patched = patchViewConfig(base, {
      layout: { type: "table", density: "compact", preview: "bottom-peek" },
    });

    expect(patched.layout).toEqual({
      type: "table",
      density: "compact",
      preview: "bottom-peek",
    });
    expect(patched.propertyVisibility).toEqual(base.propertyVisibility);
    expect(patched.sort).toEqual(base.sort);
    expect(patched.group).toEqual(base.group);
    expect(patched.filters).toEqual(base.filters);
  });
});

describe("normalizeViewConfig propertyVisibility enhancement", () => {
  it("normalizes propertyVisibility to one current entity property per row", () => {
    const result = normalizeViewConfig(
      {
        propertyVisibility: [
          { property: "status", side: "right", visible: true },
          { property: "stale_property", side: "left", visible: true },
          { property: "key", side: "left", visible: false },
        ],
      },
      jiraIssueEntity,
    );

    // status and key come first (in input order), stale_property dropped, rest appended
    expect(result.propertyVisibility.map((row) => row.property)).toEqual([
      "status",
      "key",
      "title",
      "assignee",
      "updated_at_source",
      "priority",
      "labels",
      "project_key",
    ]);
    expect(result.propertyVisibility.find((row) => row.property === "stale_property")).toBeUndefined();
    expect(result.propertyVisibility.find((row) => row.property === "status")).toEqual({
      property: "status",
      side: "right",
      visible: true,
    });
  });

  it("forces the stretch title property visible during normalization", () => {
    const result = normalizeViewConfig(
      {
        propertyVisibility: jiraIssueEntity.defaultProperties.map((row) =>
          row.property === "title" ? { ...row, visible: false } : row,
        ),
      },
      jiraIssueEntity,
    );

    expect(result.propertyVisibility.find((row) => row.property === "title")).toEqual({
      property: "title",
      side: "left",
      visible: true,
    });
  });

  it("falls back invalid property side to entity default side", () => {
    const result = normalizeViewConfig(
      {
        propertyVisibility: [
          { property: "status", side: "middle", visible: true },
        ],
      },
      jiraIssueEntity,
    );

    expect(result.propertyVisibility.find((row) => row.property === "status")?.side).toBe("right");
  });
});

describe("property visibility helpers", () => {
  it("setPropertyVisible toggles one property and keeps other rows stable", () => {
    const base = defaultViewConfig(jiraIssueEntity);
    const result = setPropertyVisible(base.propertyVisibility, "labels", true, jiraIssueEntity);

    expect(result.find((row) => row.property === "labels")?.visible).toBe(true);
    expect(result.filter((row) => row.property !== "labels")).toEqual(
      base.propertyVisibility.filter((row) => row.property !== "labels"),
    );
    expect(result).not.toBe(base.propertyVisibility);
  });

  it("setPropertyVisible refuses to hide the title property", () => {
    const base = defaultViewConfig(jiraIssueEntity);
    const result = setPropertyVisible(base.propertyVisibility, "title", false, jiraIssueEntity);

    expect(result.find((row) => row.property === "title")?.visible).toBe(true);
  });

  it("setPropertySide changes side without changing list order", () => {
    const base = defaultViewConfig(jiraIssueEntity);
    const result = setPropertySide(base.propertyVisibility, "priority", "right");

    expect(result.map((row) => row.property)).toEqual(base.propertyVisibility.map((row) => row.property));
    expect(result.find((row) => row.property === "priority")?.side).toBe("right");
  });

  it("moveProperty places a property at the requested canonical index", () => {
    const base = defaultViewConfig(jiraIssueEntity).propertyVisibility;
    // default order: key, title, assignee, status, updated_at_source, priority, labels, project_key
    // move "assignee" (index 2) to index 1 -> key, assignee, title, status, ...
    const result = moveProperty(base, "assignee", 1);

    expect(result.map((row) => row.property).slice(0, 4)).toEqual(["key", "assignee", "title", "status"]);
  });

  it("applyPropertyDrop reorders and sets destination visibility", () => {
    const base = defaultViewConfig(jiraIssueEntity).propertyVisibility;
    // Move "labels" to just before "status" (in the base order, status is at index 3)
    // After removing labels (index 6), "status" is at index 3 -> targetIndex=3
    // -> key, title, assignee, labels, status, ...
    const result = applyPropertyDrop(base, "labels", "status", true, jiraIssueEntity);

    expect(result.find((row) => row.property === "labels")?.visible).toBe(true);
    const labelIndex = result.findIndex((row) => row.property === "labels");
    const statusIndex = result.findIndex((row) => row.property === "status");
    expect(labelIndex).toBeLessThan(statusIndex);
  });

  it("applyPropertyDrop appends to the end when overId is null", () => {
    const base = defaultViewConfig(jiraIssueEntity).propertyVisibility;
    const result = applyPropertyDrop(base, "key", null, false, jiraIssueEntity);

    expect(result[result.length - 1]).toEqual({ property: "key", side: "left", visible: false });
  });

  it("applyPropertyDrop keeps title visible when dropped into hidden", () => {
    const base = defaultViewConfig(jiraIssueEntity).propertyVisibility;
    const result = applyPropertyDrop(base, "title", "labels", false, jiraIssueEntity);

    expect(result.find((row) => row.property === "title")?.visible).toBe(true);
  });
});

describe("sort config normalization", () => {
  it("drops stale properties, invalid directions, and duplicate sort properties", () => {
    const config = normalizeViewConfig(
      {
        sort: [
          { property: "status", direction: "asc" },
          { property: "missing", direction: "asc" },
          { property: "updated_at_source", direction: "sideways" },
          { property: "status", direction: "desc" },
          { property: "priority", direction: "desc" },
        ],
      },
      jiraIssueEntity,
    );

    expect(config.sort).toEqual([
      { property: "status", direction: "asc" },
      { property: "priority", direction: "desc" },
    ]);
  });

  it("keeps sort empty when no sort is configured", () => {
    expect(normalizeViewConfig({}, jiraIssueEntity).sort).toEqual([]);
  });
});

describe("sort config helpers", () => {
  it("adds the first unused sortable property with its default direction", () => {
    const config = { ...defaultViewConfig(jiraIssueEntity), sort: [] };
    expect(addSortLevel(config, jiraIssueEntity)).toEqual([{ property: "key", direction: "asc" }]);
  });

  it("adds Updated with its property default direction when earlier properties are used", () => {
    const config = {
      ...defaultViewConfig(jiraIssueEntity),
      sort: [
        { property: "key", direction: "asc" as const },
        { property: "title", direction: "asc" as const },
        { property: "status", direction: "asc" as const },
        { property: "assignee", direction: "asc" as const },
      ],
    };
    expect(addSortLevel(config, jiraIssueEntity).at(-1)).toEqual({ property: "updated_at_source", direction: "desc" });
  });

  it("updates, toggles, removes, moves, and clears sort levels immutably", () => {
    const sort = [
      { property: "status", direction: "asc" as const },
      { property: "updated_at_source", direction: "desc" as const },
      { property: "priority", direction: "asc" as const },
    ];

    expect(setSortProperty(sort, 1, "assignee")).toEqual([
      { property: "status", direction: "asc" },
      { property: "assignee", direction: "desc" },
      { property: "priority", direction: "asc" },
    ]);
    expect(toggleSortDirection(sort, 0)).toEqual([
      { property: "status", direction: "desc" },
      { property: "updated_at_source", direction: "desc" },
      { property: "priority", direction: "asc" },
    ]);
    expect(removeSortLevel(sort, 1)).toEqual([
      { property: "status", direction: "asc" },
      { property: "priority", direction: "asc" },
    ]);
    expect(moveSortLevel(sort, 2, 0)).toEqual([
      { property: "priority", direction: "asc" },
      { property: "status", direction: "asc" },
      { property: "updated_at_source", direction: "desc" },
    ]);
    expect(clearSort()).toEqual([]);
    expect(sort[0]).toEqual({ property: "status", direction: "asc" });
  });

  it("availableSortProperties keeps the current row selectable and excludes other used properties", () => {
    const options = availableSortProperties(
      jiraIssueEntity,
      [
        { property: "status", direction: "asc" },
        { property: "updated_at_source", direction: "desc" },
      ],
      "status",
    );
    expect(options.map((option) => option.id)).toContain("status");
    expect(options.map((option) => option.id)).not.toContain("updated_at_source");
  });
});
