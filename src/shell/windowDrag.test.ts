import { beforeEach, describe, expect, it, vi } from "vitest";
import { shouldStartWindowDrag, startWindowDragFromPointerEvent } from "./windowDrag";

const startDraggingMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({ startDragging: startDraggingMock })),
}));

type FakePointerEvent = {
  button: number;
  defaultPrevented: boolean;
  target: EventTarget | null;
  preventDefault: ReturnType<typeof vi.fn>;
};

function fakeEvent(target: EventTarget | null, overrides: Partial<FakePointerEvent> = {}): FakePointerEvent {
  return {
    button: 0,
    defaultPrevented: false,
    target,
    preventDefault: vi.fn(),
    ...overrides,
  };
}

describe("windowDrag", () => {
  beforeEach(() => {
    startDraggingMock.mockClear();
  });

  it("allows primary-button pointer events on drag-active elements", () => {
    const dragRegion = document.createElement("div");
    dragRegion.setAttribute("data-tauri-drag-region", "");

    expect(shouldStartWindowDrag(fakeEvent(dragRegion))).toBe(true);
  });

  it("rejects non-primary buttons", () => {
    const dragRegion = document.createElement("div");
    dragRegion.setAttribute("data-tauri-drag-region", "");

    expect(shouldStartWindowDrag(fakeEvent(dragRegion, { button: 2 }))).toBe(false);
  });

  it("rejects events that were already prevented", () => {
    const dragRegion = document.createElement("div");
    dragRegion.setAttribute("data-tauri-drag-region", "");

    expect(shouldStartWindowDrag(fakeEvent(dragRegion, { defaultPrevented: true }))).toBe(false);
  });

  it("rejects events from no-drag islands", () => {
    const island = document.createElement("button");
    island.className = "titlebar-no-drag";
    const icon = document.createElement("span");
    island.appendChild(icon);

    expect(shouldStartWindowDrag(fakeEvent(icon))).toBe(false);
  });

  it("prevents default and asks Tauri to start dragging", async () => {
    const dragRegion = document.createElement("div");
    dragRegion.setAttribute("data-tauri-drag-region", "");
    const event = fakeEvent(dragRegion);

    startWindowDragFromPointerEvent(event);
    await vi.waitFor(() => expect(startDraggingMock).toHaveBeenCalledTimes(1));

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  it("does not ask Tauri to drag rejected events", async () => {
    const noDrag = document.createElement("button");
    noDrag.className = "titlebar-no-drag";
    const event = fakeEvent(noDrag);

    startWindowDragFromPointerEvent(event);
    await Promise.resolve();

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(startDraggingMock).not.toHaveBeenCalled();
  });
});
