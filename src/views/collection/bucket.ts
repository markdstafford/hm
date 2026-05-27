import type { BucketContext, BucketDefinition, EntityContract } from "./types";
import type { GroupConfig } from "./ViewConfig";

export type BucketedGroup<TItem> = {
  key: string;
  label: string;
  items: TItem[];
};

type Args<TItem, TProperty extends string> = {
  items: TItem[];
  entity: EntityContract<TItem, TProperty>;
  group: GroupConfig;
  context?: BucketContext;
};

function labelFor(key: string, definition: BucketDefinition | undefined, fallback?: (key: string) => string): string {
  return definition?.label ?? fallback?.(key) ?? key;
}

export function bucketCollectionItems<TItem, TProperty extends string>({
  items,
  entity,
  group,
  context,
}: Args<TItem, TProperty>): BucketedGroup<TItem>[] {
  if (group.property === null) return [];
  const groupable = (entity.groupableProperties ?? []).find(
    (candidate) => String(candidate.property) === group.property,
  );
  if (!groupable) return [];

  const definitions = groupable.bucketOrder(items, context);
  const definitionByKey = new Map(definitions.map((definition) => [definition.key, definition]));
  const itemsByKey = new Map<string, TItem[]>();

  for (const item of items) {
    let key = "Unknown";
    try {
      key = groupable.bucketKeyFor(item, context);
    } catch {
      key = "Unknown";
    }
    itemsByKey.set(key, [...(itemsByKey.get(key) ?? []), item]);
  }

  const knownGroups = definitions
    .map((definition) => ({
      key: definition.key,
      label: definition.label,
      items: itemsByKey.get(definition.key) ?? [],
    }))
    .filter((bucket) => !group.hideEmptyGroups || bucket.items.length > 0);

  const unknownGroups = [...itemsByKey.entries()]
    .filter(([key]) => !definitionByKey.has(key))
    .map(([key, bucketItems]) => ({
      key,
      label: labelFor(key, undefined, groupable.bucketLabelFor),
      items: bucketItems,
    }))
    .filter((bucket) => !group.hideEmptyGroups || bucket.items.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

  return [...knownGroups, ...unknownGroups];
}

export function flattenBucketedGroups<TItem>(
  groups: BucketedGroup<TItem>[],
  options: { collapsedGroupKeys?: ReadonlySet<string> } = {},
): TItem[] {
  const collapsed = options.collapsedGroupKeys ?? new Set<string>();
  return groups.flatMap((group) => (collapsed.has(group.key) ? [] : group.items));
}
