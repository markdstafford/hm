import type { HygieneSuggestion } from "../../entities/hygiene-suggestion/types";

export const HYGIENE_SUGGESTION_FIXTURE: HygieneSuggestion[] = [
  {
    id: "hygiene-duplicate-amp-1149",
    category: "duplicate",
    action: "merge-as-duplicate",
    confidence: 94,
    rationale: "The issues share a title phrase, affected area, and recent reproduction notes.",
    target: { key: "AMP-1149", title: "Search panel hangs when filters change", status: "Open", assignee: "Tarek Hassan", updatedAt: "2026-05-19" },
    duplicateOf: { key: "AMP-1102", title: "Search panel hangs after applying saved filter", status: "Open", assignee: null, updatedAt: "2026-05-12" },
  },
  {
    id: "hygiene-stale-amp-1043",
    category: "stale",
    action: "close-as-resolved",
    confidence: 88,
    rationale: "The release shipped and no new activity has occurred for six weeks.",
    target: { key: "AMP-1043", title: "Worker pool exits on empty queue on shutdown", status: "Open", assignee: "Priya Naidu", updatedAt: "2026-04-12" },
    lastActivityAt: "2026-04-12",
  },
  {
    id: "hygiene-stale-amp-1068",
    category: "stale",
    action: "ping-for-context",
    confidence: 58,
    rationale: "Ownership is unclear and the last update predates the current planning cycle.",
    target: { key: "AMP-1068", title: "Clarify notification retry policy", status: "In review", assignee: null, updatedAt: null },
    lastActivityAt: null,
  },
  {
    id: "hygiene-enrichment-amp-1180",
    category: "enrichment",
    action: "enrich-title-and-body",
    confidence: 76,
    rationale: "The current ticket title is too short for backlog grooming.",
    target: { key: "AMP-1180", title: "bug", status: "Backlog", assignee: "Elena Rivera", body: null, labels: ["bug"], updatedAt: "2026-05-22" },
    proposed: { title: "Crash on Settings source save", body: "## Steps to reproduce\n1. Add a Jira source\n2. Save the source\n3. Reopen Settings", labels: ["bug", "P1"] },
  },
];
