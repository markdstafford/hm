import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSidebarToggle } from "./useSidebarToggle";

describe("useSidebarToggle", () => {
  it("defaults to visible", () => {
    const { result } = renderHook(() => useSidebarToggle());
    expect(result.current.visible).toBe(true);
  });

  it("toggles on `[` key", () => {
    const { result } = renderHook(() => useSidebarToggle());
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "[" }));
    });
    expect(result.current.visible).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "[" }));
    });
    expect(result.current.visible).toBe(true);
  });

  it("setVisible accepts boolean", () => {
    const { result } = renderHook(() => useSidebarToggle());
    act(() => result.current.setVisible(false));
    expect(result.current.visible).toBe(false);
  });
});
