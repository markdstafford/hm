export type HygieneCategory = "duplicate" | "stale" | "enrichment";

export type HygieneAction =
  | "close-as-resolved"
  | "merge-as-duplicate"
  | "reassign"
  | "ping-for-context"
  | "enrich-title-and-body";

export type HygieneIssueRef = {
  key: string;
  title: string;
  status?: string | null;
  assignee?: string | null;
  updatedAt?: string | null;
  body?: string | null;
  labels?: string[];
};

export type HygieneProposedChange = {
  title?: string | null;
  body?: string | null;
  labels?: string[];
};

export type HygieneSuggestion = {
  id: string;
  category: HygieneCategory;
  action: HygieneAction;
  confidence: number;
  rationale: string;
  target: HygieneIssueRef;
  duplicateOf?: HygieneIssueRef | null;
  lastActivityAt?: string | null;
  proposed?: HygieneProposedChange | null;
};

export type HygieneSuggestionProperty =
  | "action"
  | "key"
  | "title"
  | "confidence"
  | "category"
  | "status"
  | "assignee"
  | "rationale";
