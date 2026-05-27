import type { SortLevelConfig } from "./ViewConfig";
import type { EntityContract } from "./types";

export function buildCollectionComparator<TItem, TProperty extends string>(
  levels: SortLevelConfig[],
  entity: EntityContract<TItem, TProperty>,
): (a: TItem, b: TItem) => number {
  const sortPropMap = new Map(
    (entity.sortableProperties ?? []).map((row) => [String(row.property), row]),
  );
  const validLevels = levels.filter((level) => sortPropMap.has(level.property));

  return (a, b) => {
    for (const level of validLevels) {
      const sortProp = sortPropMap.get(level.property);
      if (!sortProp) continue;

      // When the property declares isNull, apply null-last independently of direction.
      if (sortProp.isNull) {
        const aNull = sortProp.isNull(a);
        const bNull = sortProp.isNull(b);
        if (aNull && bNull) continue;
        if (aNull) return 1;
        if (bNull) return -1;
      }

      const result = sortProp.compare(a, b);
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
