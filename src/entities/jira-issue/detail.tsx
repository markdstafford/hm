import { Badge } from "../../ui/data/Badge";
import type { JiraIssueListItem } from "../../bindings";
import { UpdatedCell } from "./cells";

type Props = { item: JiraIssueListItem };

export function JiraIssueDetail({ item }: Props) {
  return (
    <div className="p-4 flex flex-col gap-3">
      <span className="font-mono text-xs text-subtext">{item.key || "Unknown key"}</span>
      <h2 className="text-base font-medium text-text leading-snug">{item.title}</h2>

      <div className="flex items-center gap-2 flex-wrap">
        {item.status_name && <Badge>{item.status_name}</Badge>}
        <span className="text-sm text-subtext">
          {item.assignee_display_name ?? "Unassigned"}
        </span>
      </div>

      {item.project_key && (
        <span
          data-testid="detail-project-key"
          className="font-mono text-xs text-subtext"
        >
          {item.project_key}
        </span>
      )}

      {item.updated_at_source && (
        <span data-testid="detail-updated" className="text-xs text-subtext">
          <UpdatedCell item={item} property="updated_at_source" />
        </span>
      )}
    </div>
  );
}
