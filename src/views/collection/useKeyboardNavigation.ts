import { useEffect } from "react";
import { isFormFieldTarget } from "../../shell/keys";

export type UseKeyboardNavigationArgs = {
  enabled: boolean;
  previewOpen: boolean;
  selectedIndex: number;
  total: number;
  onMovePrevious: () => void;
  onMoveNext: () => void;
  onOpenPreview: () => void;
  onClosePreview: () => void;
};

export function useKeyboardNavigation({
  enabled,
  previewOpen,
  selectedIndex,
  total,
  onMovePrevious,
  onMoveNext,
  onOpenPreview,
  onClosePreview,
}: UseKeyboardNavigationArgs): void {
  useEffect(() => {
    if (!enabled || selectedIndex < 0 || total <= 0) return;

    function onKeyDown(event: KeyboardEvent) {
      if (isFormFieldTarget(event.target)) return;
      // isFormFieldTarget checks contentEditable via the IDL property, which some environments
      // (e.g., jsdom) do not implement. Fall back to the reflected HTML attribute.
      if (event.target instanceof HTMLElement) {
        const attr = event.target.getAttribute("contenteditable");
        if (attr === "true" || attr === "plaintext-only" || attr === "") return;
      }
      const canMovePrevious = selectedIndex > 0;
      const canMoveNext = selectedIndex < total - 1;

      if (event.key === "ArrowUp" && canMovePrevious) {
        event.preventDefault();
        onMovePrevious();
      } else if (event.key === "ArrowDown" && canMoveNext) {
        event.preventDefault();
        onMoveNext();
      } else if (event.key === "k" && canMovePrevious) {
        event.preventDefault();
        onMovePrevious();
      } else if (event.key === "j" && canMoveNext) {
        event.preventDefault();
        onMoveNext();
      } else if (event.key === "Enter" && !previewOpen) {
        event.preventDefault();
        onOpenPreview();
      } else if (event.key === "Escape" && previewOpen) {
        event.preventDefault();
        onClosePreview();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, previewOpen, selectedIndex, total, onMovePrevious, onMoveNext, onOpenPreview, onClosePreview]);
}
