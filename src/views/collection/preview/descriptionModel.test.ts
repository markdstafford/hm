import { describe, expect, it } from "vitest";
import { isEmptyPreviewBody } from "./descriptionModel";

describe("isEmptyPreviewBody", () => {
  it("treats null, undefined, empty strings, and whitespace as empty", () => {
    expect(isEmptyPreviewBody(null)).toBe(true);
    expect(isEmptyPreviewBody(undefined)).toBe(true);
    expect(isEmptyPreviewBody("")).toBe(true);
    expect(isEmptyPreviewBody("   \n\t  ")).toBe(true);
  });

  it("treats non-whitespace strings as populated", () => {
    expect(isEmptyPreviewBody("Steps to reproduce")).toBe(false);
    expect(isEmptyPreviewBody("  Has text  ")).toBe(false);
  });
});
