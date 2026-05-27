import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "../../ui/feedback/EmptyState";
import { bucketCollectionItems } from "./bucket";
import { Row } from "./Row";
import { SectionHeader } from "./SectionHeader";
import type { GroupConfig, ViewDensity } from "./ViewConfig";
import type { EntityContract, PropertyConfig } from "./types";

type Props<TItem, TProperty extends string> = {
  items: TItem[];
  unfilteredCount?: number;
  entity: EntityContract<TItem, TProperty>;
  properties?: PropertyConfig<TProperty>[];
  group?: GroupConfig;
  collapsedGroupKeys?: ReadonlySet<string>;
  onToggleGroupCollapsed?: (bucketKey: string) => void;
  selectedId: string | null;
  density?: ViewDensity;
  onSelect: (item: TItem) => void;
};

export function Body<TItem, TProperty extends string>({
  items,
  unfilteredCount,
  entity,
  properties,
  group,
  collapsedGroupKeys,
  onToggleGroupCollapsed,
  selectedId,
  density = "regular",
  onSelect,
}: Props<TItem, TProperty>) {
  const resolvedProperties = properties ?? entity.defaultProperties;
  const activeGroupProperty = group?.property ?? null;

  const [localCollapsed, setLocalCollapsed] = useState<Set<string>>(new Set());
  const collapsed = collapsedGroupKeys ?? localCollapsed;

  const grouped = useMemo(
    () =>
      group && group.property !== null
        ? bucketCollectionItems({ items, entity, group })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entity, group, items],
  );

  useEffect(() => {
    setLocalCollapsed(new Set());
  }, [activeGroupProperty]);

  function toggleCollapsed(bucketKey: string) {
    if (onToggleGroupCollapsed) {
      onToggleGroupCollapsed(bucketKey);
      return;
    }
    setLocalCollapsed((current) => {
      const next = new Set(current);
      if (next.has(bucketKey)) next.delete(bucketKey);
      else next.add(bucketKey);
      return next;
    });
  }

  if (items.length === 0) {
    if ((unfilteredCount ?? 0) > 0) {
      return (
        <EmptyState
          title={`No matching ${entity.label}`}
          description="Try changing or clearing filters for this view."
        />
      );
    }
    return (
      <EmptyState
        title={`No ${entity.label} yet`}
        description={`No ${entity.label.toLowerCase()} have been loaded.`}
      />
    );
  }

  if (group && group.property !== null && grouped.length > 0) {
    return (
      <div className="flex flex-col">
        {grouped.map((bucket) => (
          <div key={bucket.key} className="flex flex-col">
            <SectionHeader
              bucketKey={bucket.key}
              label={bucket.label}
              count={bucket.items.length}
              collapsed={collapsed.has(bucket.key)}
              onToggleCollapsed={toggleCollapsed}
            />
            {!collapsed.has(bucket.key) &&
              bucket.items.map((item) => (
                <Row
                  key={entity.getId(item)}
                  item={item}
                  entity={entity}
                  properties={resolvedProperties}
                  selectedId={selectedId}
                  density={density}
                  groupedPropertyId={group.property}
                  onSelect={onSelect}
                />
              ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {items.map((item) => (
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
