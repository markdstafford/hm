import type { ActiveCollectionRoot, CollectionRootSnapshot } from "./types";

export function createBaseRoot<TItem>(
  items: TItem[],
  selectedId: string | null,
  previewOpen: boolean,
): ActiveCollectionRoot<TItem> {
  return {
    id: "base",
    label: "All items",
    items,
    selectedId,
    previewOpen,
    base: true,
  };
}

export function pushScopedRoot<TItem>({
  activeRoot,
  stack,
  nextRoot,
}: {
  activeRoot: ActiveCollectionRoot<TItem>;
  stack: ActiveCollectionRoot<TItem>[];
  nextRoot: CollectionRootSnapshot<TItem>;
}): { activeRoot: ActiveCollectionRoot<TItem>; stack: ActiveCollectionRoot<TItem>[] } {
  return {
    activeRoot: { ...nextRoot, base: false, parentLabel: activeRoot.label },
    stack: [...stack, activeRoot],
  };
}

export function returnToPreviousRoot<TItem>({
  activeRoot,
  stack,
  getId,
}: {
  activeRoot: ActiveCollectionRoot<TItem>;
  stack: ActiveCollectionRoot<TItem>[];
  getId: (item: TItem) => string;
}): { activeRoot: ActiveCollectionRoot<TItem>; stack: ActiveCollectionRoot<TItem>[] } {
  if (stack.length === 0) return { activeRoot, stack };
  const nextStack = stack.slice(0, -1);
  const previous = stack[stack.length - 1];
  const selectedExists = previous.selectedId
    ? previous.items.some((item) => getId(item) === previous.selectedId)
    : false;
  return {
    activeRoot: {
      ...previous,
      selectedId: selectedExists ? previous.selectedId : null,
      previewOpen: selectedExists ? previous.previewOpen : false,
    },
    stack: nextStack,
  };
}
