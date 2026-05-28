import type { PropertySide, EntityContract, GroupableProperty } from "./types";
import { normalizeFilterRows, summarizeFilters } from "./filter/config";

export type LayoutType = "table";
export type ViewDensity = "compact" | "regular";
export type PreviewSurface = "side-peek" | "bottom-peek" | "full-page";
export type SortDirection = "asc" | "desc";

export type PropertyVisibilityConfig = {
  property: string;
  side: PropertySide;
  visible: boolean;
};

export type SortLevelConfig = {
  property: string;
  direction: SortDirection;
};

export type GroupConfig = {
  property: string | null;
  hideEmptyGroups: boolean;
};

export type FilterConfig = {
  id: string;
  property: string;
  operator: string;
  value: unknown;
  active: boolean;
};

export type ConditionalColorConfig = {
  enabled: false;
  rules: [];
};

export type ViewConfig = {
  layout: { type: LayoutType; density: ViewDensity; preview: PreviewSurface };
  propertyVisibility: PropertyVisibilityConfig[];
  sort: SortLevelConfig[];
  group: GroupConfig;
  filters: FilterConfig[];
  conditionalColor: ConditionalColorConfig;
};

export type ViewConfigSummary = {
  layout: string;
  propertyVisibility: string;
  sort: string;
  group: string;
  filter: string;
  conditionalColor: "Soon";
};

export type SortPropertyOption = {
  id: string;
  label: string;
  defaultDirection: SortDirection;
};

// --- Internal guards ---

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDensity(value: unknown): value is ViewDensity {
  return value === "compact" || value === "regular";
}

function isPreview(value: unknown): value is PreviewSurface {
  return value === "side-peek" || value === "bottom-peek" || value === "full-page";
}

function isSortDirection(value: unknown): value is SortDirection {
  return value === "asc" || value === "desc";
}

function isSide(value: unknown): value is PropertySide {
  return value === "left" || value === "right";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function titlePropertyId(entity: EntityContract<any, any>): string | null {
  return entity.properties.find((property) => property.isStretch)?.id ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function defaultPropertyRow(
  entity: EntityContract<any, any>,
  propertyId: string,
): PropertyVisibilityConfig {
  const defaultRow = entity.defaultProperties.find((row) => row.property === propertyId);
  return {
    property: propertyId,
    side: defaultRow?.side ?? "left",
    visible: defaultRow?.visible ?? true,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizePropertyVisibilityRows(
  input: unknown,
  entity: EntityContract<any, any>,
): PropertyVisibilityConfig[] {
  const currentIds = entity.properties.map((property) => String(property.id));
  const currentSet = new Set(currentIds);
  // Use defaultProperties order for appending, to match defaultViewConfig ordering
  const defaultOrder = entity.defaultProperties.map((row) => row.property);
  const titleId = titlePropertyId(entity);
  const seen = new Set<string>();
  const rows: PropertyVisibilityConfig[] = [];

  if (Array.isArray(input)) {
    for (const rawRow of input) {
      if (!isObject(rawRow) || typeof rawRow["property"] !== "string") continue;
      const propertyId = rawRow["property"];
      if (!currentSet.has(propertyId) || seen.has(propertyId)) continue;
      const defaultRow = defaultPropertyRow(entity, propertyId);
      rows.push({
        property: propertyId,
        side: isSide(rawRow["side"]) ? rawRow["side"] : defaultRow.side,
        visible:
          propertyId === titleId
            ? true
            : typeof rawRow["visible"] === "boolean"
              ? rawRow["visible"]
              : defaultRow.visible,
      });
      seen.add(propertyId);
    }
  }

  for (const propertyId of defaultOrder) {
    if (seen.has(propertyId)) continue;
    const row = defaultPropertyRow(entity, propertyId);
    rows.push({ ...row, visible: propertyId === titleId ? true : row.visible });
  }

  // Append any properties in entity.properties not covered by defaultProperties
  for (const propertyId of currentIds) {
    if (seen.has(propertyId) || defaultOrder.includes(propertyId)) continue;
    const row = defaultPropertyRow(entity, propertyId);
    rows.push({ ...row, visible: propertyId === titleId ? true : row.visible });
  }

  return rows;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sortablePropertyIds(entity: EntityContract<any, any>): string[] {
  return (entity.sortableProperties ?? []).map((row) => String(row.property));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function groupablePropertyIds(entity: EntityContract<any, any>): string[] {
  return (entity.groupableProperties ?? []).map((row) => String(row.property));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function groupablePropertyLabel(entity: EntityContract<any, any>, propertyId: string): string | null {
  const groupable = (entity.groupableProperties ?? []).find((row) => row.property === propertyId);
  if (!groupable) return null;
  return entity.properties.find((p) => p.id === groupable.property)?.label ?? "Unknown property";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeSortRows(input: unknown, entity: EntityContract<any, any>): SortLevelConfig[] {
  const sortableIds = new Set(sortablePropertyIds(entity));
  const seen = new Set<string>();
  const rows: SortLevelConfig[] = [];

  if (!Array.isArray(input)) return rows;

  for (const rawRow of input) {
    if (!isObject(rawRow)) continue;
    const property = rawRow["property"];
    const direction = rawRow["direction"];
    if (typeof property !== "string") continue;
    if (!isSortDirection(direction)) continue;
    if (!sortableIds.has(property) || seen.has(property)) continue;
    rows.push({ property, direction });
    seen.add(property);
  }

  return rows;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function propertyLabel(entity: EntityContract<any, any>, propertyId: string): string {
  const found = entity.properties.find((p) => p.id === propertyId);
  if (found) return found.label;
  if (propertyId) return propertyId;
  return "Unknown property";
}

// --- Public API ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function defaultViewConfig(entity: EntityContract<any, any>): ViewConfig {
  return {
    layout: { type: "table", density: "regular", preview: "side-peek" },
    propertyVisibility: entity.defaultProperties.map((p) => ({
      property: p.property,
      side: p.side,
      visible: p.visible,
    })),
    sort: [],
    group: { property: null, hideEmptyGroups: true },
    filters: [],
    conditionalColor: { enabled: false, rules: [] },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeViewConfig(input: unknown, entity: EntityContract<any, any>): ViewConfig {
  const defaults = defaultViewConfig(entity);

  if (!isObject(input)) {
    return defaults;
  }

  // layout
  const rawLayout = input["layout"];
  const defaultLayout = defaults.layout;
  let layout = { ...defaultLayout };
  if (isObject(rawLayout)) {
    if (isDensity(rawLayout["density"])) {
      layout = { ...layout, density: rawLayout["density"] };
    }
    if (isPreview(rawLayout["preview"])) {
      layout = { ...layout, preview: rawLayout["preview"] };
    }
    if (rawLayout["type"] === "table") {
      layout = { ...layout, type: "table" };
    }
  }

  // propertyVisibility
  const propertyVisibility = normalizePropertyVisibilityRows(input["propertyVisibility"], entity);

  // sort
  const sort = normalizeSortRows(input["sort"], entity);

  // group
  let group = defaults.group;
  const rawGroup = input["group"];
  if (isObject(rawGroup)) {
    const gProperty = rawGroup["property"];
    const gHide = rawGroup["hideEmptyGroups"];
    const groupableIds = new Set(groupablePropertyIds(entity));
    group = {
      property:
        typeof gProperty === "string" && groupableIds.has(gProperty)
          ? gProperty
          : null,
      hideEmptyGroups: typeof gHide === "boolean" ? gHide : true,
    };
  }

  // filters
  const filters = normalizeFilterRows(input["filters"], entity);

  return {
    layout,
    propertyVisibility,
    sort,
    group,
    filters,
    conditionalColor: { enabled: false, rules: [] },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function availableSortProperties(
  entity: EntityContract<any, any>,
  currentSort: SortLevelConfig[],
  currentProperty?: string,
): SortPropertyOption[] {
  const used = new Set(currentSort.map((row) => row.property));
  return (entity.sortableProperties ?? [])
    .filter((row) => {
      const id = String(row.property);
      return id === currentProperty || !used.has(id);
    })
    .map((row) => {
      const id = String(row.property);
      return {
        id,
        label: propertyLabel(entity, id),
        defaultDirection: row.defaultDirection ?? "asc",
      };
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function addSortLevel(config: ViewConfig, entity: EntityContract<any, any>): SortLevelConfig[] {
  const option = availableSortProperties(entity, config.sort)[0];
  if (!option) return config.sort.map((row) => ({ ...row }));
  return [...config.sort.map((row) => ({ ...row })), { property: option.id, direction: option.defaultDirection }];
}

export function setSortProperty(
  rows: SortLevelConfig[],
  index: number,
  property: string,
): SortLevelConfig[] {
  return rows.map((row, rowIndex) =>
    rowIndex === index ? { ...row, property } : { ...row },
  );
}

export function toggleSortDirection(rows: SortLevelConfig[], index: number): SortLevelConfig[] {
  return rows.map((row, rowIndex) =>
    rowIndex === index
      ? { ...row, direction: row.direction === "asc" ? "desc" : "asc" }
      : { ...row },
  );
}

export function removeSortLevel(rows: SortLevelConfig[], index: number): SortLevelConfig[] {
  return rows.filter((_, rowIndex) => rowIndex !== index).map((row) => ({ ...row }));
}

export function moveSortLevel(rows: SortLevelConfig[], fromIndex: number, toIndex: number): SortLevelConfig[] {
  const next = rows.map((row) => ({ ...row }));
  if (fromIndex < 0 || fromIndex >= next.length) return next;
  const [moved] = next.splice(fromIndex, 1);
  const safeIndex = Math.max(0, Math.min(toIndex, next.length));
  next.splice(safeIndex, 0, moved);
  return next;
}

export function clearSort(): SortLevelConfig[] {
  return [];
}

export function setGroupProperty(group: GroupConfig, property: string | null): GroupConfig {
  return { property, hideEmptyGroups: group.hideEmptyGroups };
}

export function removeGrouping(group: GroupConfig): GroupConfig {
  return { property: null, hideEmptyGroups: group.hideEmptyGroups };
}

export function setHideEmptyGroups(group: GroupConfig, hideEmptyGroups: boolean): GroupConfig {
  return { property: group.property, hideEmptyGroups };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function availableGroupProperties(entity: EntityContract<any, any>): GroupableProperty<any, any>[] {
  return entity.groupableProperties ?? [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function summarizeViewConfig(config: ViewConfig, entity: EntityContract<any, any>): ViewConfigSummary {
  // layout
  const densityLabel = config.layout.density === "compact" ? "Compact" : "Regular";
  const layout = `Table · ${densityLabel}`;

  // propertyVisibility
  const visibleCount = config.propertyVisibility.filter((p) => p.visible).length;
  const totalCount = entity.properties.length;
  const propertyVisibility = `${visibleCount} of ${totalCount}`;

  // sort
  let sort = "None";
  if (config.sort.length > 0) {
    const first = config.sort[0];
    const label = propertyLabel(entity, first.property);
    const arrow = first.direction === "asc" ? "↑" : "↓";
    sort = `${label} ${arrow}`;
  }

  // group
  const group =
    config.group.property === null
      ? "None"
      : groupablePropertyLabel(entity, config.group.property) ?? "Unknown property";

  // filter
  const filter = summarizeFilters(config.filters, entity);

  return {
    layout,
    propertyVisibility,
    sort,
    group,
    filter,
    conditionalColor: "Soon",
  };
}

export function patchViewConfig(config: ViewConfig, patch: Partial<ViewConfig>): ViewConfig {
  return {
    layout: patch.layout ? { ...config.layout, ...patch.layout } : { ...config.layout },
    propertyVisibility: patch.propertyVisibility
      ? [...patch.propertyVisibility]
      : [...config.propertyVisibility],
    sort: patch.sort ? [...patch.sort] : [...config.sort],
    group: patch.group ? { ...config.group, ...patch.group } : { ...config.group },
    filters: patch.filters ? [...patch.filters] : [...config.filters],
    conditionalColor: { enabled: false, rules: [] },
  };
}

export function setPropertyVisible(
  rows: PropertyVisibilityConfig[],
  propertyId: string,
  visible: boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entity: EntityContract<any, any>,
): PropertyVisibilityConfig[] {
  const titleId = titlePropertyId(entity);
  return rows.map((row) =>
    row.property === propertyId
      ? { ...row, visible: row.property === titleId ? true : visible }
      : { ...row },
  );
}

export function setPropertySide(
  rows: PropertyVisibilityConfig[],
  propertyId: string,
  side: PropertySide,
): PropertyVisibilityConfig[] {
  return rows.map((row) =>
    row.property === propertyId ? { ...row, side } : { ...row },
  );
}

export function moveProperty(
  rows: PropertyVisibilityConfig[],
  propertyId: string,
  targetIndex: number,
): PropertyVisibilityConfig[] {
  const next = rows.map((row) => ({ ...row }));
  const currentIndex = next.findIndex((row) => row.property === propertyId);
  if (currentIndex < 0) return next;
  const [moved] = next.splice(currentIndex, 1);
  const safeIndex = Math.max(0, Math.min(targetIndex, next.length));
  next.splice(safeIndex, 0, moved);
  return next;
}

export function applyPropertyDrop(
  rows: PropertyVisibilityConfig[],
  activeId: string,
  overId: string | null,
  destinationVisible: boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entity: EntityContract<any, any>,
): PropertyVisibilityConfig[] {
  const activeIndex = rows.findIndex((row) => row.property === activeId);
  if (activeIndex < 0) return rows.map((row) => ({ ...row }));

  const withoutActive = rows.filter((row) => row.property !== activeId);
  const overIndex = overId
    ? withoutActive.findIndex((row) => row.property === overId)
    : withoutActive.length;
  const targetIndex = overIndex < 0 ? withoutActive.length : overIndex;
  const activeRow = setPropertyVisible([rows[activeIndex]], activeId, destinationVisible, entity)[0];
  const next = withoutActive.map((row) => ({ ...row }));
  next.splice(targetIndex, 0, { ...activeRow });
  return next;
}
