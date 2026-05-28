import { type ReactNode, useMemo, useState } from "react";
import { Eye, EyeOff, GripVertical, PanelLeft, PanelRight, Tag } from "lucide-react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
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
import { TextField } from "../../../../ui/forms/TextField";
import { PanelHeader } from "../PanelHeader";
import type { ViewConfig, PropertyVisibilityConfig } from "../../ViewConfig";
import { applyPropertyDrop, patchViewConfig, setPropertySide, setPropertyVisible } from "../../ViewConfig";
import type { EntityContract, PropertyDefinition, PropertySide } from "../../types";

type Props<TItem = unknown, TProperty extends string = string> = {
  entity: EntityContract<TItem, TProperty>;
  config: ViewConfig;
  onPatchConfig: (config: ViewConfig) => void | Promise<void>;
  onBack: () => void;
  onClose: () => void;
};

type JoinedRow<TItem, TProperty extends string> = {
  property: PropertyDefinition<TItem, TProperty>;
  config: PropertyVisibilityConfig;
};

function findTitlePropertyId<TItem, TProperty extends string>(entity: EntityContract<TItem, TProperty>): string | null {
  return entity.properties.find((p) => p.isStretch)?.id ?? null;
}

function PropertyIcon({ property }: { property: PropertyDefinition<unknown, string> }) {
  return (
    <span className="flex h-control-sm w-control-sm items-center justify-center text-subtext">
      {property.icon ?? <Tag size={13} aria-hidden />}
    </span>
  );
}

type SortablePropertyRowProps = {
  row: JoinedRow<unknown, string>;
  titleId: string | null;
  dragDisabled: boolean;
  onSideChange: (propertyId: string, side: PropertySide) => void;
  onVisibilityChange: (propertyId: string, visible: boolean) => void;
};

function SortablePropertyRow({ row, titleId, dragDisabled, onSideChange, onVisibilityChange }: SortablePropertyRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.config.property,
    disabled: dragDisabled,
  });
  const label = row.property.label;
  const isTitleProperty = row.config.property === titleId;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-property-id={row.config.property}
      className={`flex items-center gap-1 rounded px-1 py-1 text-sm hover:bg-surface ${isDragging ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        data-drag-handle="true"
        className="titlebar-no-drag inline-flex h-control-sm w-control-sm items-center justify-center rounded text-subtext hover:bg-surface-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus aria-disabled:opacity-50 aria-disabled:cursor-default"
        {...attributes}
        aria-label={`Reorder ${label}`}
        aria-disabled={dragDisabled || undefined}
        {...(dragDisabled ? {} : listeners)}
      >
        <GripVertical size={13} aria-hidden />
      </button>
      <PropertyIcon property={row.property as PropertyDefinition<unknown, string>} />
      <span className="min-w-0 flex-1 truncate text-text">{label}</span>
      <div className="flex overflow-hidden rounded border border-border">
        <button
          type="button"
          aria-label={`Move ${label} left`}
          aria-pressed={row.config.side === "left"}
          onClick={() => onSideChange(row.config.property, "left")}
          className={`flex h-control-sm w-control-sm items-center justify-center text-xs ${
            row.config.side === "left" ? "bg-surface-1 text-text" : "text-subtext hover:bg-surface"
          }`}
        >
          <PanelLeft size={12} aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`Move ${label} right`}
          aria-pressed={row.config.side === "right"}
          onClick={() => onSideChange(row.config.property, "right")}
          className={`flex h-control-sm w-control-sm items-center justify-center border-l border-border text-xs ${
            row.config.side === "right" ? "bg-surface-1 text-text" : "text-subtext hover:bg-surface"
          }`}
        >
          <PanelRight size={12} aria-hidden />
        </button>
      </div>
      <IconButton
        label={isTitleProperty ? "Title is always visible" : row.config.visible ? `Hide ${label}` : `Show ${label}`}
        disabled={isTitleProperty}
        active={row.config.visible}
        onClick={() => onVisibilityChange(row.config.property, !row.config.visible)}
      >
        {row.config.visible ? <Eye size={13} aria-hidden /> : <EyeOff size={13} aria-hidden />}
      </IconButton>
    </li>
  );
}

function DroppableSection({
  id,
  title,
  children,
}: {
  id: "shown" | "hidden";
  title: "Shown" | "Hidden";
  children: ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <section ref={setNodeRef} aria-labelledby={`property-visibility-${id}`} data-section-id={id}>
      <h3
        id={`property-visibility-${id}`}
        className="px-1 text-xs font-medium text-subtext"
        style={{ fontVariantCaps: "all-small-caps" }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

export function PropertyVisibilityPanel<TItem = unknown, TProperty extends string = string>({
  entity,
  config,
  onPatchConfig,
  onBack,
  onClose,
}: Props<TItem, TProperty>) {
  const [query, setQuery] = useState("");
  const titleId = findTitlePropertyId(entity);
  const normalizedQuery = query.trim().toLowerCase();

  const rows = useMemo<JoinedRow<TItem, TProperty>[]>(() => {
    return config.propertyVisibility
      .map((row) => {
        const property = entity.properties.find((p) => String(p.id) === row.property);
        return property ? { property, config: row } : null;
      })
      .filter((row): row is JoinedRow<TItem, TProperty> => row !== null)
      .filter((row) =>
        normalizedQuery.length === 0
          ? true
          : row.property.label.toLowerCase().includes(normalizedQuery),
      );
  }, [config.propertyVisibility, entity.properties, normalizedQuery]);

  const shownRows = rows.filter((row) => row.config.visible);
  const hiddenRows = rows.filter((row) => !row.config.visible);

  const dragDisabled = normalizedQuery.length > 0;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function patchPropertyVisibility(nextRows: PropertyVisibilityConfig[]) {
    void onPatchConfig(patchViewConfig(config, { propertyVisibility: nextRows }));
  }

  function handleSideChange(propertyId: string, side: PropertySide) {
    patchPropertyVisibility(setPropertySide(config.propertyVisibility, propertyId, side));
  }

  function handleVisibilityChange(propertyId: string, visible: boolean) {
    patchPropertyVisibility(setPropertyVisible(config.propertyVisibility, propertyId, visible, entity));
  }

  function destinationVisibleFromOver(overId: string | null): boolean {
    if (overId === "shown") return true;
    if (overId === "hidden") return false;
    const overRow = config.propertyVisibility.find((row) => row.property === overId);
    return overRow?.visible ?? true;
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;
    patchPropertyVisibility(
      applyPropertyDrop(
        config.propertyVisibility,
        activeId,
        overId === "shown" || overId === "hidden" ? null : overId,
        destinationVisibleFromOver(overId),
        entity,
      ),
    );
  }

  return (
    <>
      <PanelHeader title="Property visibility" onBack={onBack} onClose={onClose} />
      <div className="border-b border-border/60 px-3 py-2">
        <TextField
          aria-label="Search properties"
          placeholder="Search properties"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {dragDisabled && (
        <p className="px-3 pt-2 text-xs text-subtext">Clear search to reorder properties.</p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex max-h-[28rem] flex-col gap-4 overflow-y-auto px-3 py-3">
          <DroppableSection id="shown" title="Shown">
            {shownRows.length > 0 ? (
              <SortableContext
                items={shownRows.map((row) => row.config.property)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="mt-1 flex flex-col gap-0.5">
                  {shownRows.map((row) => (
                    <SortablePropertyRow
                      key={row.config.property}
                      row={row as unknown as JoinedRow<unknown, string>}
                      titleId={titleId}
                      dragDisabled={dragDisabled}
                      onSideChange={handleSideChange}
                      onVisibilityChange={handleVisibilityChange}
                    />
                  ))}
                </ul>
              </SortableContext>
            ) : (
              <p className="px-1 py-2 text-sm text-subtext">No shown properties match</p>
            )}
          </DroppableSection>
          <DroppableSection id="hidden" title="Hidden">
            {hiddenRows.length > 0 ? (
              <SortableContext
                items={hiddenRows.map((row) => row.config.property)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="mt-1 flex flex-col gap-0.5">
                  {hiddenRows.map((row) => (
                    <SortablePropertyRow
                      key={row.config.property}
                      row={row as unknown as JoinedRow<unknown, string>}
                      titleId={titleId}
                      dragDisabled={dragDisabled}
                      onSideChange={handleSideChange}
                      onVisibilityChange={handleVisibilityChange}
                    />
                  ))}
                </ul>
              </SortableContext>
            ) : (
              <p className="px-1 py-2 text-sm text-subtext">No hidden properties match</p>
            )}
          </DroppableSection>
        </div>
      </DndContext>
    </>
  );
}
