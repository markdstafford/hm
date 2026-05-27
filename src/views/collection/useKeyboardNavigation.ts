import { useEffect } from "react";
import { isFormFieldTarget } from "../../shell/keys";

export type UseKeyboardNavigationArgs = {
  /** False when the collection viewer is not the focused surface (settings open, etc.). */
  enabled: boolean;
  selectedIndex: number;
  total: number;
  previewOpen: boolean;
  onSelectFirst: () => void;
  onSelectLast: () => void;
  onMovePrevious: () => void;
  onMoveNext: () => void;
  onOpenPreview: () => void;
  onClosePreview: () => void;
};

/**
 * Keyboard model for the collection viewer.
 *
 * Always active when the collection is the focused surface:
 *   ArrowDown / j → next row (selects first if none selected)
 *   ArrowUp / k   → previous row (selects last if none selected)
 *   Enter         → open preview when row selected and preview closed
 *   Escape        → close preview when open; selection stays
 *
 * Form fields (`input`, `textarea`, `contenteditable`) suppress all bindings so
 * typing in the rename textbox or any filter input doesn't move selection.
 */
export function useKeyboardNavigation({
  enabled,
  selectedIndex,
  total,
  previewOpen,
  onSelectFirst,
  onSelectLast,
  onMovePrevious,
  onMoveNext,
  onOpenPreview,
  onClosePreview,
}: UseKeyboardNavigationArgs): void {
  useEffect(() => {
    if (!enabled || total <= 0) return;

    function onKeyDown(event: KeyboardEvent) {
      if (isFormFieldTarget(event.target)) return;
      // isFormFieldTarget checks contentEditable via the IDL property, which some
      // environments (e.g., jsdom) do not implement. Fall back to the reflected
      // HTML attribute.
      if (event.target instanceof HTMLElement) {
        const attr = event.target.getAttribute("contenteditable");
        if (attr === "true" || attr === "plaintext-only" || attr === "") return;
      }

      const k = event.key;
      const moveDown = k === "ArrowDown" || k === "j";
      const moveUp = k === "ArrowUp" || k === "k";

      if (moveDown) {
        event.preventDefault();
        if (selectedIndex < 0) {
          onSelectFirst();
        } else if (selectedIndex < total - 1) {
          onMoveNext();
        }
        return;
      }
      if (moveUp) {
        event.preventDefault();
        if (selectedIndex < 0) {
          onSelectLast();
        } else if (selectedIndex > 0) {
          onMovePrevious();
        }
        return;
      }
      if (k === "Enter") {
        if (selectedIndex < 0) return;
        if (previewOpen) return; // open already; user said noop
        event.preventDefault();
        onOpenPreview();
        return;
      }
      if (k === "Escape") {
        if (!previewOpen) return;
        event.preventDefault();
        onClosePreview();
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    enabled,
    selectedIndex,
    total,
    previewOpen,
    onSelectFirst,
    onSelectLast,
    onMovePrevious,
    onMoveNext,
    onOpenPreview,
    onClosePreview,
  ]);
}
