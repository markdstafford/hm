import type { CollectionViewRecord, CollectionViewSaveInput } from "../../../bindings";

export type CollectionEntityKind = string;

export type CollectionView = {
  id: string;
  entityKind: CollectionEntityKind;
  displayName: string;
  position: number;
  isDefault: boolean;
  config: unknown;
};

export type CollectionViewDraft = Omit<CollectionView, "id"> & { id?: string };

export function fromCollectionViewRecord(record: CollectionViewRecord): CollectionView {
  return {
    id: record.id,
    entityKind: record.entity_kind,
    displayName: record.display_name,
    position: record.position,
    isDefault: record.is_default,
    config: record.config,
  };
}

export function toCollectionViewSaveInput(view: CollectionView): CollectionViewSaveInput {
  return {
    id: view.id,
    entity_kind: view.entityKind,
    display_name: view.displayName,
    position: view.position,
    is_default: view.isDefault,
    config: view.config,
  };
}
