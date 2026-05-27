import type { SortLevelConfig } from "./ViewConfig";
import type { EntityContract, PropertyComparator } from "./types";

function comparatorMap<TItem, TProperty extends string>(
  entity: EntityContract<TItem, TProperty>,
): Map<string, PropertyComparator<TItem>> {
  return new Map(
    (entity.sortableProperties ?? []).map((row) => [String(row.property), row.compare]),
  );
}

export function buildCollectionComparator<TItem, TProperty extends string>(
  levels: SortLevelConfig[],
  entity: EntityContract<TItem, TProperty>,
): (a: TItem, b: TItem) => number {
  const comparators = comparatorMap(entity);
  const validLevels = levels.filter((level) => comparators.has(level.property));

  return (a, b) => {
    for (const level of validLevels) {
      const compare = comparators.get(level.property);
      if (!compare) continue;
      const result = compare(a, b);
      if (result !== 0) return level.direction === "desc" ? -result : result;
    }
    return entity.defaultSort(a, b);
  };
}

export function sortCollectionItems<TItem, TProperty extends string>(
  items: TItem[],
  entity: EntityContract<TItem, TProperty>,
  levels: SortLevelConfig[] = [],
): TItem[] {
  return [...items].sort(buildCollectionComparator(levels, entity));
}
