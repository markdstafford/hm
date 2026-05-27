import { describe, expect, it } from "vitest";
import { jiraIssueEntity } from "../../entities/jira-issue";
import { defaultViewConfig } from "../../views/collection/ViewConfig";
import type { CollectionView } from "../../views/collection/views/types";
import { buildConfigPatchView, buildRenameView } from "./viewConfigPersistence";

const view: CollectionView = {
  id: "jira-issue-mine",
  entityKind: "jira-issue",
  displayName: "Mine",
  position: 1,
  isDefault: true,
  config: {},
};

describe("viewConfigPersistence", () => {
  it("renames a view and persists a normalized config", () => {
    const renamed = buildRenameView(view, "Assigned to me", jiraIssueEntity);
    expect(renamed).toMatchObject({ id: view.id, displayName: "Assigned to me", position: 1, isDefault: true });
    expect(renamed.config).toEqual(defaultViewConfig(jiraIssueEntity));
  });

  it("patches config while preserving view identity and display name", () => {
    const patchedConfig = {
      ...defaultViewConfig(jiraIssueEntity),
      layout: { type: "table" as const, density: "compact" as const, preview: "side-peek" as const },
    };
    const patched = buildConfigPatchView(view, patchedConfig);
    expect(patched).toMatchObject({ id: view.id, displayName: "Mine", entityKind: "jira-issue" });
    expect(patched.config).toEqual(patchedConfig);
  });

  it("preserves filters when building a config patch", () => {
    const configWithFilters = {
      ...defaultViewConfig(jiraIssueEntity),
      filters: [{ id: "f1", property: "status", operator: "is", value: null, active: true }],
    };
    const result = buildConfigPatchView(view, configWithFilters);
    expect(result).toMatchObject({ id: view.id, displayName: "Mine" });
    expect((result.config as typeof configWithFilters).filters).toEqual(configWithFilters.filters);
  });
});
