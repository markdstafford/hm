import { useState } from "react";
import { Spinner } from "../../ui/feedback/Spinner";
import { EmptyState } from "../../ui/feedback/EmptyState";
import { Body } from "../../views/collection/Body";
import { Detail } from "../../views/collection/Detail";
import { jiraIssueEntity } from "../../entities/jira-issue";
import { useJiraIssues } from "./data";
import type { JiraIssueListItem } from "../../bindings";

export function CollectionViewerPage() {
  const { issues, loading, error } = useJiraIssues();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedItem: JiraIssueListItem | null =
    issues.find((i) => i.work_item_id === selectedId) ?? null;

  function handleSelect(item: JiraIssueListItem) {
    setSelectedId(item.work_item_id);
  }

  function handleClose() {
    setSelectedId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1 p-8">
        <Spinner label="Loading Jira issues" size={20} />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Could not load Jira issues"
        description="Something went wrong. Check the console for details."
        className="flex-1"
      />
    );
  }

  if (issues.length === 0) {
    return (
      <EmptyState
        title="No Jira issues yet"
        description="Run Jira ingestion from Settings → Sources to populate this list."
        className="flex-1"
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <Body
          items={issues}
          entity={jiraIssueEntity}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      </div>
      {selectedItem && (
        <Detail
          item={selectedItem}
          entity={jiraIssueEntity}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
