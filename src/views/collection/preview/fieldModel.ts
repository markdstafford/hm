import type {
  PreviewFieldConfig,
  PreviewFieldDefinition,
  PreviewFieldSourceConfig,
  PreviewFieldTier,
  ResolvedPreviewField,
} from "../types";

export type PartitionedPreviewFields<TItem, TProperty extends string> = {
  tierOne: ResolvedPreviewField<TItem, TProperty>[];
  secondary: ResolvedPreviewField<TItem, TProperty>[];
  hiddenEmpty: ResolvedPreviewField<TItem, TProperty>[];
};

export function genericPreviewFieldIsEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function isPreviewFieldTier(value: unknown): value is PreviewFieldTier {
  return value === 1 || value === 2 || value === 3;
}

function defaultTierFor<TProperty extends string>(
  property: TProperty,
  defaults: PreviewFieldConfig<TProperty>[],
): PreviewFieldTier {
  return defaults.find((field) => field.property === property)?.tier ?? 2;
}

export function normalizePreviewFieldConfig<TItem, TProperty extends string>(
  definitions: PreviewFieldDefinition<TItem, TProperty>[],
  defaults: PreviewFieldConfig<TProperty>[] = [],
  sourceConfig: PreviewFieldConfig<TProperty>[] = [],
): PreviewFieldConfig<TProperty>[] {
  const known = new Set(definitions.map((definition) => definition.property));
  const included = new Set<TProperty>();
  const normalized: PreviewFieldConfig<TProperty>[] = [];

  for (const config of sourceConfig) {
    if (!known.has(config.property) || included.has(config.property)) continue;
    const tier = isPreviewFieldTier(config.tier)
      ? config.tier
      : defaultTierFor(config.property, defaults);
    normalized.push({
      property: config.property,
      tier,
      ...(config.pinned ? { pinned: true } : {}),
    });
    included.add(config.property);
  }

  for (const config of defaults) {
    if (!known.has(config.property) || included.has(config.property)) continue;
    const tier = isPreviewFieldTier(config.tier) ? config.tier : 2;
    normalized.push({
      property: config.property,
      tier,
      ...(config.pinned ? { pinned: true } : {}),
    });
    included.add(config.property);
  }

  return normalized;
}

export function resolvePreviewFieldConfig<TItem, TProperty extends string>({
  definitions,
  defaults = [],
  sourceConfigs = [],
  entityId,
  sourceId,
}: {
  definitions: PreviewFieldDefinition<TItem, TProperty>[];
  defaults?: PreviewFieldConfig<TProperty>[];
  sourceConfigs?: PreviewFieldSourceConfig<TProperty>[];
  entityId: string;
  sourceId: string | null;
}): PreviewFieldConfig<TProperty>[] {
  const match = sourceConfigs.find(
    (config) => config.entityId === entityId && config.sourceId === sourceId,
  );
  return normalizePreviewFieldConfig(definitions, defaults, match?.fields ?? []);
}

export function isPreviewFieldPopulated<TItem, TProperty extends string>(
  item: TItem,
  definition: PreviewFieldDefinition<TItem, TProperty>,
): boolean {
  if (definition.isEmpty) return !definition.isEmpty(item);
  return true;
}

export function partitionPreviewFields<TItem, TProperty extends string>(
  item: TItem,
  definitions: PreviewFieldDefinition<TItem, TProperty>[],
  config: PreviewFieldConfig<TProperty>[],
): PartitionedPreviewFields<TItem, TProperty> {
  const byProperty = new Map(definitions.map((definition) => [definition.property, definition]));
  const tierOne: ResolvedPreviewField<TItem, TProperty>[] = [];
  const secondary: ResolvedPreviewField<TItem, TProperty>[] = [];
  const hiddenEmpty: ResolvedPreviewField<TItem, TProperty>[] = [];

  for (const row of config) {
    const definition = byProperty.get(row.property);
    if (!definition) continue;
    const pinned = row.pinned === true;
    const effectiveTier: PreviewFieldTier = pinned ? 1 : row.tier;
    const resolved: ResolvedPreviewField<TItem, TProperty> = {
      definition,
      config: row,
      effectiveTier,
      pinned,
    };

    if (!isPreviewFieldPopulated(item, definition)) {
      hiddenEmpty.push(resolved);
    } else if (effectiveTier === 1) {
      tierOne.push(resolved);
    } else {
      secondary.push(resolved);
    }
  }

  return { tierOne, secondary, hiddenEmpty };
}
