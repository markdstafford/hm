import { describe, expect, it } from "vitest";
import {
  defaultOperatorForKind,
  operatorFor,
  operatorsForKind,
  operatorRequiresValue,
} from "./operators";
import type { FilterKind } from "./types";

const expected: Record<FilterKind, string[]> = {
  text: ["contains", "does-not-contain", "is", "is-not", "starts-with", "ends-with", "empty", "not-empty"],
  number: ["eq", "neq", "gt", "lt", "gte", "lte", "empty", "not-empty"],
  select: ["contains", "does-not-contain", "is", "is-not", "empty", "not-empty"],
  "multi-select": ["contains", "does-not-contain", "empty", "not-empty"],
  date: ["is", "before", "after", "on-or-before", "on-or-after", "within", "empty", "not-empty"],
  person: ["contains", "does-not-contain", "empty", "not-empty"],
  checkbox: ["is", "is-not"],
};

describe("collection filter operators", () => {
  it.each(Object.entries(expected) as [FilterKind, string[]][])(
    "returns the exact operator list for %s",
    (kind, ids) => {
      expect(operatorsForKind(kind).map((operator) => operator.id)).toEqual(ids);
    },
  );

  it.each(Object.entries(expected) as [FilterKind, string[]][])(
    "uses the first %s operator as the default",
    (kind, ids) => {
      expect(defaultOperatorForKind(kind).id).toBe(ids[0]);
    },
  );

  it("looks up an operator only when it belongs to the requested kind", () => {
    expect(operatorFor("text", "contains")?.label).toBe("contains");
    expect(operatorFor("date", "contains")).toBeNull();
    expect(operatorFor("select", "does-not-contain")?.valueControl).toBe("multi-select");
  });

  it("marks empty/not-empty and checkbox operators as complete without a separate value", () => {
    expect(operatorRequiresValue(operatorFor("text", "contains")!)).toBe(true);
    expect(operatorRequiresValue(operatorFor("text", "empty")!)).toBe(false);
    expect(operatorRequiresValue(operatorFor("checkbox", "is")!)).toBe(false);
  });
});
