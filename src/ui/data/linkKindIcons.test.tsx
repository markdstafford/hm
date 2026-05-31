import { describe, it, expect } from "vitest";
import { LINK_KIND_META, LINK_KINDS } from "./linkKindIcons";

describe("LINK_KIND_META", () => {
  it("exports exactly source, local, and suggested kinds", () => {
    expect(LINK_KINDS).toEqual(["source", "local", "suggested"]);
    expect(Object.keys(LINK_KIND_META)).toEqual(["source", "local", "suggested"]);
  });

  it("provides accessible labels and descriptions", () => {
    expect(LINK_KIND_META.source.label).toBe("Source link");
    expect(LINK_KIND_META.source.description).toBe("Stored in the source system");
    expect(LINK_KIND_META.local.label).toBe("Local link");
    expect(LINK_KIND_META.local.description).toBe("Stored only in hm");
    expect(LINK_KIND_META.suggested.label).toBe("Suggested link");
    expect(LINK_KIND_META.suggested.description).toBe("Computed related item");
  });

  it("uses distinct icon shapes", () => {
    expect(LINK_KIND_META.source.Icon).not.toBe(LINK_KIND_META.local.Icon);
    expect(LINK_KIND_META.local.Icon).not.toBe(LINK_KIND_META.suggested.Icon);
    expect(LINK_KIND_META.source.Icon).not.toBe(LINK_KIND_META.suggested.Icon);
  });
});
