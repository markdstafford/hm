import { describe, it, expect } from "vitest";
import { jiraIssueEntity } from "../../entities/jira-issue";
import {
  defaultViewConfig,
  normalizeViewConfig,
  summarizeViewConfig,
  patchViewConfig,
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
        { property: 123, side: "left", visible: true }, // invalid property
        { property: "status", side: "invalid-side", visible: true }, // invalid side
      ],
    };
    const result = normalizeViewConfig(input, jiraIssueEntity);
    expect(result.propertyVisibility).toEqual([{ property: "key", side: "left", visible: true }]);
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
});
