import type { BucketDefinition, EntityContract, GroupableProperty } from "../../views/collection/types";
import type { HygieneSuggestion, HygieneSuggestionProperty } from "./types";
import { DEFAULT_PROPERTIES, HYGIENE_SUGGESTION_DEFAULT_VIEWS } from "./defaults";
import {
  ACTION_BUCKET_ORDER,
  CATEGORY_BUCKET_ORDER,
  CONFIDENCE_BUCKET_ORDER,
  actionLabel,
  compareHygieneByAction,
  compareHygieneByAssignee,
  compareHygieneByCategory,
  compareHygieneByConfidence,
  compareHygieneByKey,
  compareHygieneByStatus,
  compareHygieneByTitle,
  confidenceBucketFor,
  derivedAssignee,
  derivedKey,
  derivedStatus,
  hygieneFilterableProperties,
} from "./properties";
import {
  ActionCell,
  AssigneeCell,
  CategoryCell,
  ConfidenceCell,
  KeyCell,
  RationaleCell,
  StatusCell,
  TitleCell,
} from "./cells";
import { SuggestionDetail } from "./detail";

function discoveredBuckets(values: string[], fallback: string): BucketDefinition[] {
  const nonFallback = [...new Set(values.filter((v) => v !== fallback))].sort((a, b) =>
    a.localeCompare(b),
  );
  const result: BucketDefinition[] = nonFallback.map((key) => ({ key, label: key }));
  if (values.includes(fallback)) {
    result.push({ key: fallback, label: fallback });
  }
  return result;
}

const GROUPABLE_PROPERTIES: GroupableProperty<HygieneSuggestion, HygieneSuggestionProperty>[] = [
  {
    property: "action",
    bucketKeyFor: (item) => item.action,
    bucketOrder: () => ACTION_BUCKET_ORDER,
  },
  {
    property: "category",
    bucketKeyFor: (item) => item.category,
    bucketOrder: () => CATEGORY_BUCKET_ORDER,
  },
  {
    property: "confidence",
    bucketKeyFor: (item) => confidenceBucketFor(item.confidence).key,
    bucketOrder: () => CONFIDENCE_BUCKET_ORDER,
  },
  {
    property: "status",
    bucketKeyFor: derivedStatus,
    bucketOrder: (items = []) => discoveredBuckets(items.map(derivedStatus), "No status"),
  },
  {
    property: "assignee",
    bucketKeyFor: derivedAssignee,
    bucketOrder: (items = []) => discoveredBuckets(items.map(derivedAssignee), "Unassigned"),
  },
];

export const hygieneSuggestionEntity: EntityContract<HygieneSuggestion, HygieneSuggestionProperty> = {
  id: "hygiene-suggestion",
  label: "Hygiene suggestions",
  detailLabel: "suggestion",
  getId: (item) => item.id,
  getRowLabel: (item) => `${actionLabel(item.action)} for ${derivedKey(item)}`,
  properties: [
    { id: "action", label: "Action", kind: "categorical", renderCell: (props) => <ActionCell {...props} /> },
    { id: "key", label: "Key", kind: "text", renderCell: (props) => <KeyCell {...props} /> },
    { id: "title", label: "Title", kind: "text", isStretch: true, renderCell: (props) => <TitleCell {...props} /> },
    { id: "assignee", label: "Assignee", kind: "text", renderCell: (props) => <AssigneeCell {...props} /> },
    { id: "status", label: "Status", kind: "categorical", renderCell: (props) => <StatusCell {...props} /> },
    { id: "category", label: "Category", kind: "categorical", renderCell: (props) => <CategoryCell {...props} /> },
    { id: "confidence", label: "Confidence", kind: "number", renderCell: (props) => <ConfidenceCell {...props} /> },
    { id: "rationale", label: "Rationale", kind: "text", renderCell: (props) => <RationaleCell {...props} /> },
  ],
  defaultProperties: DEFAULT_PROPERTIES,
  defaultSort: (a, b) => compareHygieneByConfidence(b, a) || compareHygieneByKey(a, b),
  sortableProperties: [
    { property: "action", compare: compareHygieneByAction },
    { property: "category", compare: compareHygieneByCategory },
    { property: "confidence", compare: compareHygieneByConfidence, defaultDirection: "desc" },
    { property: "status", compare: compareHygieneByStatus, isNull: (item) => !item.target.status?.trim() },
    { property: "assignee", compare: compareHygieneByAssignee, isNull: (item) => !item.target.assignee?.trim() },
    { property: "key", compare: compareHygieneByKey },
    { property: "title", compare: compareHygieneByTitle },
  ],
  groupableProperties: GROUPABLE_PROPERTIES,
  filterableProperties: hygieneFilterableProperties,
  Detail: SuggestionDetail,
  defaultViews: HYGIENE_SUGGESTION_DEFAULT_VIEWS,
};
