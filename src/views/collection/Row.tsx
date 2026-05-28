import { Square } from "lucide-react";
import { Checkbox } from "../../ui/forms/Checkbox";
import type { ViewDensity } from "./ViewConfig";
import type { EntityContract, PropertyConfig } from "./types";

type RowSelection = {
  selected: boolean;
  onToggle: () => void;
  label: string;
};

type Props<TItem, TProperty extends string> = {
  item: TItem;
  entity: EntityContract<TItem, TProperty>;
  properties: PropertyConfig<TProperty>[];
  selectedId: string | null;
  density?: ViewDensity;
  groupedPropertyId?: string | null;
  selection?: RowSelection;
  onSelect: (item: TItem) => void;
};

export function Row<TItem, TProperty extends string>({
  item,
  entity,
  properties,
  selectedId,
  density = "regular",
  groupedPropertyId = null,
  selection,
  onSelect,
}: Props<TItem, TProperty>) {
  const itemId = entity.getId(item);
  const isSelected = itemId === selectedId;

  const visibleLeft = properties.filter(
    (p) => p.visible && p.side === "left" && String(p.property) !== groupedPropertyId,
  );
  const visibleRight = properties.filter(
    (p) => p.visible && p.side === "right" && String(p.property) !== groupedPropertyId,
  );

  const getDefinition = (propId: TProperty) =>
    entity.properties.find((def) => def.id === propId);

  return (
    <div
      className={`flex items-center px-3 ${density === "compact" ? "py-1" : "py-2"} gap-2 transition-colors ${
        isSelected ? "bg-surface-1" : "hover:bg-surface"
      }`}
    >
      {selection ? (
        <span
          className="flex flex-none items-center justify-center"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Checkbox
            label={selection.label}
            hideLabelText
            checked={selection.selected}
            onCheckedChange={() => selection.onToggle()}
          />
        </span>
      ) : (
        <button
          type="button"
          aria-label="Select issue (coming soon)"
          aria-disabled="true"
          className="flex flex-none items-center justify-center p-0.5 text-subtext/50 cursor-default"
          onClick={(event) => event.stopPropagation()}
        >
          <Square size={11} aria-hidden />
        </button>
      )}

      <button
        type="button"
        className="flex-1 flex items-center min-w-0 text-left gap-2"
        aria-label={entity.getRowLabel ? entity.getRowLabel(item) : `Open ${itemId}`}
        aria-pressed={isSelected}
        onClick={() => onSelect(item)}
      >
        {visibleLeft.map((config) => {
          const def = getDefinition(config.property);
          if (!def) return null;
          return (
            <span
              key={String(config.property)}
              data-property-id={String(config.property)}
              className={def.isStretch ? "flex-1 min-w-0 truncate" : "flex-none"}
            >
              {def.renderCell({ item, property: config.property })}
            </span>
          );
        })}

        {!visibleLeft.some((p) => getDefinition(p.property)?.isStretch) && (
          <span className="flex-1" aria-hidden />
        )}

        {visibleRight.map((config) => {
          const def = getDefinition(config.property);
          if (!def) return null;
          return (
            <span key={String(config.property)} data-property-id={String(config.property)} className="flex-none shrink-0">
              {def.renderCell({ item, property: config.property })}
            </span>
          );
        })}
      </button>
    </div>
  );
}
