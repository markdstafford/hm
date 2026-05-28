export type WindowDragPointerEvent = {
  button: number;
  defaultPrevented: boolean;
  target: EventTarget | null;
  preventDefault: () => void;
};

function targetElement(target: EventTarget | null): Element | null {
  return target instanceof Element ? target : null;
}

export function shouldStartWindowDrag(event: WindowDragPointerEvent): boolean {
  if (event.button !== 0) return false;
  if (event.defaultPrevented) return false;

  const element = targetElement(event.target);
  if (element?.closest(".titlebar-no-drag")) return false;

  return true;
}

async function startCurrentWindowDragging(): Promise<void> {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().startDragging();
}

export function startWindowDragFromPointerEvent(event: WindowDragPointerEvent): void {
  if (!shouldStartWindowDrag(event)) return;

  event.preventDefault();
  void startCurrentWindowDragging().catch((error: unknown) => {
    console.warn("Unable to start Tauri window drag", error);
  });
}
