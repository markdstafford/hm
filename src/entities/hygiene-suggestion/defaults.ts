import type { PropertyConfig } from "../../views/collection/types";
import type { CollectionView } from "../../views/collection/views/types";
import type { HygieneSuggestionProperty } from "./types";

export const DEFAULT_PROPERTIES: PropertyConfig<HygieneSuggestionProperty>[] = [
  { property: "action", side: "left", visible: true },
  { property: "key", side: "left", visible: true },
  { property: "title", side: "left", visible: true },
  { property: "assignee", side: "right", visible: true },
  { property: "status", side: "right", visible: true },
  { property: "category", side: "right", visible: true },
  { property: "confidence", side: "right", visible: true },
  { property: "rationale", side: "right", visible: false },
];

export const HYGIENE_SUGGESTION_DEFAULT_VIEWS: CollectionView[] = [
  {
    id: "hygiene-suggestion-all",
    entityKind: "hygiene-suggestion",
    displayName: "All",
    position: 0,
    isDefault: true,
    config: {
      sort: [
        { property: "confidence", direction: "desc" },
        { property: "key", direction: "asc" },
      ],
      group: { property: null, hideEmptyGroups: true },
      filters: [],
    },
  },
  {
    id: "hygiene-suggestion-by-action",
    entityKind: "hygiene-suggestion",
    displayName: "By action",
    position: 1,
    isDefault: true,
    config: {
      sort: [
        { property: "confidence", direction: "desc" },
        { property: "key", direction: "asc" },
      ],
      group: { property: "action", hideEmptyGroups: true },
      filters: [],
    },
  },
  {
    id: "hygiene-suggestion-high-confidence",
    entityKind: "hygiene-suggestion",
    displayName: "High confidence",
    position: 2,
    isDefault: true,
    config: {
      sort: [
        { property: "confidence", direction: "desc" },
        { property: "key", direction: "asc" },
      ],
      group: { property: null, hideEmptyGroups: true },
      filters: [
        {
          id: "hygiene-confidence-gte-85",
          property: "confidence",
          operator: "gte",
          value: "85",
          active: true,
        },
      ],
    },
  },
];
