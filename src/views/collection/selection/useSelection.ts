import { useCallback, useState } from "react";

export type SelectionState = {
  selectedIds: Set<string>;
  toggle: (id: string) => void;
  clear: () => void;
  has: (id: string) => boolean;
};

export function useSelection(initialIds: Iterable<string> = []): SelectionState {
  const [selectedIds, setSelectedIds] = useState(() => new Set(initialIds));

  const toggle = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const has = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  return { selectedIds, toggle, clear, has };
}
