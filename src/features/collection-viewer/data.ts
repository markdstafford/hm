import { useState, useEffect } from "react";
import { commands } from "../../bindings";
import type { JiraIssueListItem } from "../../bindings";

type UseJiraIssuesResult = {
  issues: JiraIssueListItem[];
  loading: boolean;
  error: string | null;
};

export function useJiraIssues(): UseJiraIssuesResult {
  const [issues, setIssues] = useState<JiraIssueListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    commands
      .jiraIssuesList({ source_id: null, project_key: null, limit: 200 })
      .then((result) => {
        if (cancelled) return;
        if (result.status === "ok") {
          setIssues(result.data);
        } else {
          setError(result.error);
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(typeof err === "string" ? err : "Unexpected error loading issues");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { issues, loading, error };
}
