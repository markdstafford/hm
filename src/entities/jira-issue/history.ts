import { commands, type JiraIssueStatusTransition } from "../../bindings";

type LoadStatusHistoryResult =
  | { status: "ok"; transitions: JiraIssueStatusTransition[]; partial: boolean }
  | { status: "error"; transitions: []; partial: false };

export async function loadJiraIssueStatusHistory(
  issueId: string,
): Promise<LoadStatusHistoryResult> {
  if (!("__TAURI_INTERNALS__" in window)) {
    return { status: "ok", transitions: [], partial: false };
  }
  try {
    const result = await commands.jiraIssueStatusTimeline(issueId);
    if (result.status === "error") {
      return { status: "error", transitions: [], partial: false };
    }
    const transitions = result.data;
    return {
      status: "ok",
      transitions,
      partial: transitions.some((transition) => transition.complete === false),
    };
  } catch {
    return { status: "error", transitions: [], partial: false };
  }
}
