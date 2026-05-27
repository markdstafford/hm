import { EmptyState } from "../../ui/feedback/EmptyState";
import { Row } from "./Row";
import type { ViewDensity } from "./ViewConfig";
import type { EntityContract, PropertyConfig } from "./types";

type Props<TItem, TProperty extends string> = {
  items: TItem[];
  entity: EntityContract<TItem, TProperty>;
  properties?: PropertyConfig<TProperty>[];
  selectedId: string | null;
  density?: ViewDensity;
  onSelect: (item: TItem) => void;
};

export function sortCollectionItems<TItem, TProperty extends string>(
  items: TItem[],
  entity: EntityContract<TItem, TProperty>,
): TItem[] {
  return [...items].sort(entity.defaultSort);
}

export function Body<TItem, TProperty extends string>({
  items,
  entity,
  properties,
  selectedId,
  density = "regular",
  onSelect,
}: Props<TItem, TProperty>) {
  const resolvedProperties = properties ?? entity.defaultProperties;
  const sorted = sortCollectionItems(items, entity);

  if (sorted.length === 0) {
    return (
      <EmptyState
        title={`No ${entity.label} yet`}
        description={`No ${entity.label.toLowerCase()} have been loaded.`}
      />
    );
  }

  return (
    <div className="flex flex-col">
      {sorted.map((item) => (
        <Row
          key={entity.getId(item)}
          item={item}
          entity={entity}
          properties={resolvedProperties}
          selectedId={selectedId}
          density={density}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
