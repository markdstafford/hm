import { jiraIssueEntity } from "../../entities/jira-issue";
import { useEntityCollectionViewer, type UseEntityCollectionViewerResult } from "./useEntityCollectionViewer";
import { useJiraIssues } from "./data";

export type UseCollectionViewerArgs = {
  /** True when the collection viewer is the focused page. Gates keyboard nav. */
  active: boolean;
};

export type { UseEntityCollectionViewerResult as UseCollectionViewerResult };

export function useCollectionViewer({ active }: UseCollectionViewerArgs): UseEntityCollectionViewerResult {
  const { issues, loading, error } = useJiraIssues();
  return useEntityCollectionViewer({
    active,
    entity: jiraIssueEntity,
    items: issues,
    loading,
    error,
    copy: {
      loadingLabel: "Loading Jira issues",
      emptyTitle: "No Jira issues yet",
      emptyDescription: "Run Jira ingestion from Settings → Sources to populate this list.",
      errorTitle: "Could not load Jira issues",
    },
  });
}
