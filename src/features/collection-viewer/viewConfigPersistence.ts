import type { EntityContract } from "../../views/collection/types";
import type { ViewConfig } from "../../views/collection/ViewConfig";
import { normalizeViewConfig } from "../../views/collection/ViewConfig";
import type { CollectionView } from "../../views/collection/views/types";

export function buildRenameView<TItem, TProperty extends string>(
  view: CollectionView,
  displayName: string,
  entity: EntityContract<TItem, TProperty>,
): CollectionView {
  return {
    ...view,
    displayName,
    config: normalizeViewConfig(view.config, entity),
  };
}

export function buildConfigPatchView(view: CollectionView, config: ViewConfig): CollectionView {
  return {
    ...view,
    config,
  };
}
