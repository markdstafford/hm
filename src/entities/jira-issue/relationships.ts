import { commands, type JiraIssueRelationshipRow } from "../../bindings";
import type { JiraIssueListItem } from "../../bindings";
import type { CollectionEdge } from "../../views/collection/navigation/types";

export type LoadRelationshipsResult =
  | { status: "ok"; edges: CollectionEdge<JiraIssueListItem>[] }
  | { status: "error" };

function relationshipLabel(type: string, side: string): string {
  const t = type.toLowerCase();
  if (side === "to") {
    // Common Jira link types — provide readable inward labels
    if (t === "blocks") return "blocked by";
    if (t === "cloners" || t === "clones") return "cloned by";
    if (t === "duplicate" || t === "duplicates") return "duplicated by";
    if (t === "subtask") return "subtask of";
    if (t === "epic") return "epic";
    if (t === "parent") return "parent";
    return `← ${t}`;
  }
  // Outward / "from" side
  if (t === "subtask") return "subtask";
  if (t === "epic") return "in epic";
  if (t === "parent") return "parent";
  return t;
}

function rowToEdge(row: JiraIssueRelationshipRow): CollectionEdge<JiraIssueListItem> {
  const relationship = relationshipLabel(row.relationship_type, row.side);
  const displayKey = row.target_key ?? row.other_key;
  const resolved = row.target_work_item_id != null && row.target_key != null;

  const targetRef = {
    entityId: "jira-issue",
    displayKey,
    title: row.target_title ?? null,
  };

  if (!resolved) {
    return {
      id: row.id,
      kind: "source" as const,
      shape: "single" as const,
      relationship,
      targetRef,
      danglingReason: "not-ingested" as const,
    };
  }

  const target: JiraIssueListItem = {
    work_item_id: row.target_work_item_id!,
    key: row.target_key!,
    title: row.target_title ?? "",
    status_name: row.target_status_name,
    assignee_display_name: row.target_assignee_display_name,
    updated_at_source: row.target_updated_at_source,
    project_key: row.target_project_key,
    priority_name: row.target_priority_name,
    labels: row.target_labels,
  };

  return {
    id: row.id,
    kind: "source" as const,
    shape: "single" as const,
    relationship,
    targetRef,
    target,
  };
}

export async function loadJiraIssueRelationships(workItemId: string): Promise<LoadRelationshipsResult> {
  if (!("__TAURI_INTERNALS__" in window)) {
    return { status: "ok", edges: [] };
  }

  try {
    const result = await commands.jiraIssueRelationships(workItemId);
    if (result.status === "error") return { status: "error" };
    return { status: "ok", edges: result.data.map(rowToEdge) };
  } catch {
    return { status: "error" };
  }
}
