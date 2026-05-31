import { useCallback, useRef, useState } from "react";

export type ElementSize = {
  width: number | null;
  height: number | null;
};

export function useElementSize<TElement extends HTMLElement>() {
  const observerRef = useRef<ResizeObserver | null>(null);
  const [size, setSize] = useState<ElementSize>({ width: null, height: null });

  const ref = useCallback((node: TElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;

    if (!node) {
      setSize({ width: null, height: null });
      return;
    }

    const measure = () => {
      const rect = node.getBoundingClientRect();
      const w = Number.isFinite(rect.width) ? Math.round(rect.width) : null;
      const h = Number.isFinite(rect.height) ? Math.round(rect.height) : null;
      setSize({
        width: w === 0 ? null : w,
        height: h === 0 ? null : h,
      });
    };

    measure();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        measure();
        return;
      }
      const box = entry.contentRect;
      const w = Number.isFinite(box.width) ? Math.round(box.width) : null;
      const h = Number.isFinite(box.height) ? Math.round(box.height) : null;
      setSize({
        width: w === 0 ? null : w,
        height: h === 0 ? null : h,
      });
    });
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  return [ref, size] as const;
}
