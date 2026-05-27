import { describe, expect, it } from "vitest";
import { fromCollectionViewRecord, toCollectionViewSaveInput } from "./types";

describe("collection view types", () => {
  it("round-trips arbitrary config payloads through save mapping", () => {
    const view = fromCollectionViewRecord({
      id: "v1",
      entity_kind: "jira-issue",
      display_name: "Mine",
      position: 1,
      is_default: false,
      config: { future: { keep: true } },
    });
    expect(toCollectionViewSaveInput(view).config).toEqual({ future: { keep: true } });
  });
});
