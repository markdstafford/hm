import { commands } from "../../bindings";
import type { PreviewComment } from "../../views/collection/preview/commentsModel";

type LoadPreviewContentResult =
  | { status: "ok"; body: string | null; comments: PreviewComment[] }
  | { status: "error"; body: null; comments: [] };

export async function loadJiraIssuePreviewContent(workItemId: string): Promise<LoadPreviewContentResult> {
  if (!("__TAURI_INTERNALS__" in window)) {
    return { status: "ok", body: null, comments: [] };
  }

  try {
    const result = await commands.jiraIssuePreviewContent(workItemId);
    if (result.status === "error") return { status: "error", body: null, comments: [] };

    return {
      status: "ok",
      body: result.data.body,
      comments: result.data.comments.map((comment) => ({
        id: comment.id,
        authorDisplayName: comment.author_display_name,
        body: comment.body,
        createdAtSource: comment.created_at_source,
        updatedAtSource: comment.updated_at_source,
        ingestedAt: comment.ingested_at,
      })),
    };
  } catch {
    return { status: "error", body: null, comments: [] };
  }
}
