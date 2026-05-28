import { describe, expect, it } from "vitest";
import { HYGIENE_SUGGESTION_FIXTURE } from "./fixture";

describe("hygiene suggestion fixture", () => {
  it("contains duplicate, stale, and enrichment suggestions across confidence buckets", () => {
    expect(HYGIENE_SUGGESTION_FIXTURE.some((item) => item.category === "duplicate")).toBe(true);
    expect(HYGIENE_SUGGESTION_FIXTURE.some((item) => item.category === "stale")).toBe(true);
    expect(HYGIENE_SUGGESTION_FIXTURE.some((item) => item.category === "enrichment")).toBe(true);
    expect(HYGIENE_SUGGESTION_FIXTURE.some((item) => item.confidence >= 85)).toBe(true);
    expect(HYGIENE_SUGGESTION_FIXTURE.some((item) => item.confidence >= 60 && item.confidence < 85)).toBe(true);
    expect(HYGIENE_SUGGESTION_FIXTURE.some((item) => item.confidence < 60)).toBe(true);
  });
});
