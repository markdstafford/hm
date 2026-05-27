import { GripVertical, X } from "lucide-react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconButton } from "../../../../ui/buttons/IconButton";
import { Select } from "../../../../ui/forms/Select";
import type { SelectOption } from "../../../../ui/forms/Select";
import { PanelHeader } from "../PanelHeader";
import {
  addSortLevel,
  availableSortProperties,
  clearSort,
  moveSortLevel,
  patchViewConfig,
  removeSortLevel,
  setSortProperty,
  toggleSortDirection,
  type SortLevelConfig,
  type ViewConfig,
} from "../../ViewConfig";
import type { EntityContract } from "../../types";

type Props<TItem = unknown, TProperty extends string = string> = {
  entity: EntityContract<TItem, TProperty>;
  config: ViewConfig;
  onPatchConfig: (config: ViewConfig) => void | Promise<void>;
  onBack: () => void;
  onClose: () => void;
};

type SortLevelRowProps = {
  id: string;
  level: SortLevelConfig;
  position: number;
  options: SelectOption[];
  onPropertyChange: (property: string) => void;
  onToggleDirection: () => void;
  onRemove: () => void;
};

function SortLevelRow({
  id,
  level,
  position,
  options,
  onPropertyChange,
  onToggleDirection,
  onRemove,
}: SortLevelRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const label = options.find((o) => o.value === level.property)?.label ?? level.property;
  const nextDirection = level.direction === "asc" ? "descending" : "ascending";

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-sort-level-id={id}
      className={`flex items-center gap-1 rounded px-1 py-1 text-sm hover:bg-surface ${isDragging ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        data-drag-handle="true"
        aria-label={`Reorder sort level ${position}`}
        className="inline-flex h-control-sm w-control-sm items-center justify-center rounded text-subtext hover:bg-surface-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={13} aria-hidden />
      </button>
      <span className="w-5 shrink-0 text-xs text-subtext" aria-label={`Sort level ${position}`}>
        {position}.
      </span>
      <Select
        aria-label={`Sort property for level ${position}`}
        value={level.property}
        options={options}
        onValueChange={onPropertyChange}
      />
      <button
        type="button"
        aria-label={`Switch sort level ${position} to ${nextDirection}`}
        onClick={onToggleDirection}
        className="inline-flex h-control-sm items-center gap-1 rounded border border-border px-2 text-xs text-text hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        {level.direction === "asc" ? "↑ Asc" : "↓ Desc"}
      </button>
      <IconButton label={`Remove ${label} sort`} onClick={onRemove}>
        <X size={13} aria-hidden />
      </IconButton>
    </li>
  );
}

export function SortPanel<TItem = unknown, TProperty extends string = string>({
  entity,
  config,
  onPatchConfig,
  onBack,
  onClose,
}: Props<TItem, TProperty>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortableCount = (entity.sortableProperties ?? []).length;
  const hasSort = config.sort.length > 0;
  const canAdd = availableSortProperties(entity, config.sort).length > 0;

  function patchSort(nextSort: SortLevelConfig[]) {
    void onPatchConfig(patchViewConfig(config, { sort: nextSort }));
  }

  const sortIds = config.sort.map((level, index) => `${level.property}:${index}`);

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;
    const fromIndex = sortIds.indexOf(activeId);
    const toIndex = sortIds.indexOf(overId);
    if (fromIndex < 0 || toIndex < 0) return;
    patchSort(moveSortLevel(config.sort, fromIndex, toIndex));
  }

  return (
    <>
      <PanelHeader title="Sort" onBack={onBack} onClose={onClose} />
      <div className="px-3 py-3">
        {sortableCount === 0 ? (
          <p className="text-sm text-subtext">No sortable properties available for this collection.</p>
        ) : !hasSort ? (
          <p className="text-sm text-subtext">
            No sort applied. Rows use the default order for this collection.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sortIds} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col gap-0.5">
                {config.sort.map((level, index) => {
                  const id = sortIds[index];
                  const options = availableSortProperties(
                    entity,
                    config.sort,
                    level.property,
                  ).map((opt): SelectOption => ({ value: opt.id, label: opt.label }));
                  return (
                    <SortLevelRow
                      key={id}
                      id={id}
                      level={level}
                      position={index + 1}
                      options={options}
                      onPropertyChange={(property) => patchSort(setSortProperty(config.sort, index, property))}
                      onToggleDirection={() => patchSort(toggleSortDirection(config.sort, index))}
                      onRemove={() => patchSort(removeSortLevel(config.sort, index))}
                    />
                  );
                })}
              </ul>
            </SortableContext>
          </DndContext>
        )}
        <div className="mt-3 flex items-center justify-between">
          <div>
            <button
              type="button"
              onClick={() => patchSort(addSortLevel(config, entity))}
              disabled={!canAdd}
              aria-describedby={!canAdd && sortableCount > 0 ? "sort-add-disabled-reason" : undefined}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-text hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Add sort
            </button>
            {!canAdd && sortableCount > 0 && (
              <p id="sort-add-disabled-reason" className="mt-1 text-xs text-subtext">
                All sortable properties are already used.
              </p>
            )}
          </div>
          {hasSort && (
            <button
              type="button"
              onClick={() => patchSort(clearSort())}
              className="rounded px-2 py-1 text-sm text-subtext hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              Clear all sort
            </button>
          )}
        </div>
      </div>
    </>
  );
}
