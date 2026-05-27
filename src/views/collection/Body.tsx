import { EmptyState } from "../../ui/feedback/EmptyState";
import { Row } from "./Row";
import type { EntityContract, PropertyConfig } from "./types";

type Props<TItem, TProperty extends string> = {
  items: TItem[];
  entity: EntityContract<TItem, TProperty>;
  properties?: PropertyConfig<TProperty>[];
  selectedId: string | null;
  onSelect: (item: TItem) => void;
};

export function Body<TItem, TProperty extends string>({
  items,
  entity,
  properties,
  selectedId,
  onSelect,
}: Props<TItem, TProperty>) {
  const resolvedProperties = properties ?? entity.defaultProperties;
  const sorted = [...items].sort(entity.defaultSort);

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
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
