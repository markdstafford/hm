import { act, renderHook } from "@testing-library/react";
import { useSelection } from "./useSelection";

describe("useSelection", () => {
  it("starts empty by default", () => {
    const { result } = renderHook(() => useSelection());

    expect(result.current.selectedIds).toBeInstanceOf(Set);
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.has("AMP-1")).toBe(false);
  });

  it("starts with provided initial ids", () => {
    const { result } = renderHook(() => useSelection(["AMP-1", "AMP-2"]));

    expect([...result.current.selectedIds]).toEqual(["AMP-1", "AMP-2"]);
    expect(result.current.has("AMP-2")).toBe(true);
  });

  it("toggles ids on and off with a new Set reference", () => {
    const { result } = renderHook(() => useSelection());
    const firstSet = result.current.selectedIds;

    act(() => result.current.toggle("AMP-1"));

    expect(result.current.selectedIds).not.toBe(firstSet);
    expect(result.current.selectedIds.has("AMP-1")).toBe(true);

    const secondSet = result.current.selectedIds;
    act(() => result.current.toggle("AMP-1"));

    expect(result.current.selectedIds).not.toBe(secondSet);
    expect(result.current.selectedIds.has("AMP-1")).toBe(false);
  });

  it("clears all ids with a new empty Set", () => {
    const { result } = renderHook(() => useSelection(["AMP-1", "AMP-2"]));
    const populatedSet = result.current.selectedIds;

    act(() => result.current.clear());

    expect(result.current.selectedIds).not.toBe(populatedSet);
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.has("AMP-1")).toBe(false);
  });

  it("keeps toggle and clear callback identities stable across selection changes", () => {
    const { result } = renderHook(() => useSelection());
    const toggle = result.current.toggle;
    const clear = result.current.clear;

    act(() => result.current.toggle("AMP-1"));

    expect(result.current.toggle).toBe(toggle);
    expect(result.current.clear).toBe(clear);
  });
});
