import { useCallback } from "react";
import { PanelHeader } from "../PanelHeader";
import type { EntityContract } from "../../types";
import type { FilterOptionContext } from "../../filter/types";
import type { ViewConfig, FilterConfig } from "../../ViewConfig";
import {
  availableFilterProperties,
  addFilter,
  removeFilter,
  updateFilterProperty,
  updateFilterOperator,
  updateFilterValue,
  clearFilters,
} from "../../filter/config";
import { patchViewConfig } from "../../ViewConfig";
import { FilterRow } from "./filter/FilterRow";

type Props<TItem = unknown, TProperty extends string = string> = {
  entity: EntityContract<TItem, TProperty>;
  items: TItem[];
  optionContext?: FilterOptionContext<TItem>;
  config: ViewConfig;
  onPatchConfig: (config: ViewConfig) => void | Promise<void>;
  onBack: () => void;
  onClose: () => void;
};

export function FilterPanel<TItem = unknown, TProperty extends string = string>({
  entity,
  optionContext,
  config,
  onPatchConfig,
  onBack,
  onClose,
}: Props<TItem, TProperty>) {
  const normalizedRows = config.filters;
  const filterableCount = availableFilterProperties(entity).length;

  const patchFilters = useCallback((nextFilters: FilterConfig[]) => {
    void onPatchConfig(patchViewConfig(config, { filters: nextFilters }));
  }, [config, onPatchConfig]);

  return (
    <>
      <PanelHeader title="Filter" onBack={onBack} onClose={onClose} />
      <div className="px-3 py-3">
        {normalizedRows.length === 0 ? (
          <p className="text-sm text-subtext">
            {filterableCount === 0
              ? "No filterable properties available for this collection."
              : "No filters yet. Add a filter to narrow this view."}
          </p>
        ) : (
          <ul aria-label="Active filters" className="flex flex-col gap-0.5">
            {normalizedRows.map((row) => (
              <FilterRow
                key={row.id}
                row={row}
                entity={entity}
                optionContext={optionContext}
                onUpdateProperty={(pid) =>
                  patchFilters(updateFilterProperty(normalizedRows, row.id, pid, entity))
                }
                onUpdateOperator={(oid) =>
                  patchFilters(updateFilterOperator(normalizedRows, row.id, oid, entity))
                }
                onUpdateValue={(v) =>
                  patchFilters(updateFilterValue(normalizedRows, row.id, v))
                }
                onRemove={() => patchFilters(removeFilter(normalizedRows, row.id))}
              />
            ))}
          </ul>
        )}
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            disabled={filterableCount === 0}
            onClick={() => patchFilters(addFilter(normalizedRows, entity))}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-text hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add filter
          </button>
          {normalizedRows.length > 0 && (
            <button
              type="button"
              onClick={() => patchFilters(clearFilters())}
              className="rounded px-2 py-1 text-sm text-subtext hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>
    </>
  );
}
