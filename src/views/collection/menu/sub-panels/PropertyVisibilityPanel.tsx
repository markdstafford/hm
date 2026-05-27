import { useMemo, useState } from "react";
import { Eye, EyeOff, GripVertical, PanelLeft, PanelRight, Tag } from "lucide-react";
import { IconButton } from "../../../../ui/buttons/IconButton";
import { TextField } from "../../../../ui/forms/TextField";
import { PanelHeader } from "../PanelHeader";
import type { ViewConfig, PropertyVisibilityConfig } from "../../ViewConfig";
import { patchViewConfig, setPropertySide, setPropertyVisible } from "../../ViewConfig";
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

  function patchPropertyVisibility(nextRows: PropertyVisibilityConfig[]) {
    void onPatchConfig(patchViewConfig(config, { propertyVisibility: nextRows }));
  }

  function handleSideChange(propertyId: string, side: PropertySide) {
    patchPropertyVisibility(setPropertySide(config.propertyVisibility, propertyId, side));
  }

  function handleVisibilityChange(propertyId: string, visible: boolean) {
    patchPropertyVisibility(setPropertyVisible(config.propertyVisibility, propertyId, visible, entity));
  }

  function renderRow(row: JoinedRow<TItem, TProperty>) {
    const isTitleProperty = row.config.property === titleId;
    const label = row.property.label;
    return (
      <li key={row.config.property} className="flex items-center gap-1 rounded px-1 py-1 text-sm hover:bg-surface">
        <button
          type="button"
          aria-label={`Reorder ${label}`}
          data-drag-handle="true"
          className="inline-flex h-control-sm w-control-sm items-center justify-center rounded text-subtext hover:bg-surface-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
            onClick={() => handleSideChange(row.config.property, "left")}
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
            onClick={() => handleSideChange(row.config.property, "right")}
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
          onClick={() => handleVisibilityChange(row.config.property, !row.config.visible)}
        >
          {row.config.visible ? <Eye size={13} aria-hidden /> : <EyeOff size={13} aria-hidden />}
        </IconButton>
      </li>
    );
  }

  function renderSection(title: "Shown" | "Hidden", sectionRows: JoinedRow<TItem, TProperty>[]) {
    const id = `property-visibility-${title.toLowerCase()}`;
    return (
      <section aria-labelledby={id}>
        <h3 id={id} className="px-1 text-xs font-medium text-subtext" style={{ fontVariantCaps: "all-small-caps" }}>
          {title}
        </h3>
        {sectionRows.length > 0 ? (
          <ul className="mt-1 flex flex-col gap-0.5">{sectionRows.map(renderRow)}</ul>
        ) : (
          <p className="px-1 py-2 text-sm text-subtext">No {title.toLowerCase()} properties match</p>
        )}
      </section>
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
      <div className="flex max-h-[28rem] flex-col gap-4 overflow-y-auto px-3 py-3">
        {renderSection("Shown", shownRows)}
        {renderSection("Hidden", hiddenRows)}
      </div>
    </>
  );
}
