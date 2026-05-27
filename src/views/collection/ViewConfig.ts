import type { PropertySide, EntityContract } from "./types";

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
  let propertyVisibility = defaults.propertyVisibility;
  const rawPV = input["propertyVisibility"];
  if (Array.isArray(rawPV)) {
    const valid = rawPV.filter(
      (row): row is PropertyVisibilityConfig =>
        isObject(row) &&
        typeof row["property"] === "string" &&
        isSide(row["side"]) &&
        typeof row["visible"] === "boolean"
    );
    if (valid.length > 0) {
      propertyVisibility = valid.map((row) => ({
        property: row.property,
        side: row.side,
        visible: row.visible,
      }));
    }
  }

  // sort
  let sort: SortLevelConfig[] = [];
  const rawSort = input["sort"];
  if (Array.isArray(rawSort)) {
    sort = rawSort
      .filter(
        (row): row is SortLevelConfig =>
          isObject(row) &&
          typeof row["property"] === "string" &&
          isSortDirection(row["direction"])
      )
      .map((row) => ({ property: row.property, direction: row.direction }));
  }

  // group
  let group = defaults.group;
  const rawGroup = input["group"];
  if (isObject(rawGroup)) {
    const gProperty = rawGroup["property"];
    const gHide = rawGroup["hideEmptyGroups"];
    if ((gProperty === null || typeof gProperty === "string") && typeof gHide === "boolean") {
      group = { property: gProperty as string | null, hideEmptyGroups: gHide };
    }
  }

  // filters
  let filters: FilterConfig[] = [];
  const rawFilters = input["filters"];
  if (Array.isArray(rawFilters)) {
    filters = rawFilters
      .filter(
        (row): row is FilterConfig =>
          isObject(row) &&
          typeof row["id"] === "string" &&
          typeof row["property"] === "string" &&
          typeof row["operator"] === "string" &&
          typeof row["active"] === "boolean"
      )
      .map((row) => ({
        id: row.id,
        property: row.property,
        operator: row.operator,
        value: row.value,
        active: row.active,
      }));
  }

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
  let group = "None";
  if (config.group.property !== null) {
    group = propertyLabel(entity, config.group.property);
  }

  // filter
  const activeFilterCount = config.filters.filter((f) => f.active).length;
  const filter = activeFilterCount > 0 ? `${activeFilterCount} active` : "None";

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
