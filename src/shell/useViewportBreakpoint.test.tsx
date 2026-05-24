import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useViewportBreakpoint } from "./useViewportBreakpoint";

describe("useViewportBreakpoint", () => {
  it("returns 'wide' when matchMedia max-width:899px does not match", () => {
    window.matchMedia = ((q: string) => ({
      matches: false, media: q, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    const { result } = renderHook(() => useViewportBreakpoint());
    expect(result.current).toBe("wide");
  });

  it("returns 'narrow' when matchMedia max-width:899px matches", () => {
    window.matchMedia = ((q: string) => ({
      matches: q.includes("max-width: 899px"), media: q, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    const { result } = renderHook(() => useViewportBreakpoint());
    expect(result.current).toBe("narrow");
  });
});
