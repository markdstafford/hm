import { afterEach, describe, expect, it, vi } from "vitest";
import { commands } from "../../bindings";
import { loadJiraIssuePreviewContent } from "./previewContent";

vi.mock("../../bindings", () => ({
  commands: {
    jiraIssuePreviewContent: vi.fn(),
  },
}));

describe("loadJiraIssuePreviewContent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  });

  it("returns empty local content outside Tauri", async () => {
    const result = await loadJiraIssuePreviewContent("wi_amp_1043");

    expect(result).toEqual({ status: "ok", body: null, comments: [] });
    expect(commands.jiraIssuePreviewContent).not.toHaveBeenCalled();
  });

  it("maps snake_case command DTOs to generic preview comments", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    vi.mocked(commands.jiraIssuePreviewContent).mockResolvedValue({
      status: "ok",
      data: {
        work_item_id: "wi_amp_1043",
        body: "Issue body",
        comments: [
          {
            id: "comment_1",
            upstream_id: "10001",
            author_display_name: "Priya",
            body: "Latest update",
            created_at_source: "2026-05-30T09:00:00Z",
            updated_at_source: "2026-05-31T10:00:00Z",
            ingested_at: "2026-05-31T10:01:00Z",
          },
        ],
      },
    });

    const result = await loadJiraIssuePreviewContent("wi_amp_1043");

    expect(commands.jiraIssuePreviewContent).toHaveBeenCalledWith("wi_amp_1043");
    expect(result).toEqual({
      status: "ok",
      body: "Issue body",
      comments: [
        {
          id: "comment_1",
          authorDisplayName: "Priya",
          body: "Latest update",
          createdAtSource: "2026-05-30T09:00:00Z",
          updatedAtSource: "2026-05-31T10:00:00Z",
          ingestedAt: "2026-05-31T10:01:00Z",
        },
      ],
    });
  });

  it("returns scoped error on typed command error or thrown invoke error", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    vi.mocked(commands.jiraIssuePreviewContent).mockResolvedValueOnce({ status: "error", error: "missing" });
    await expect(loadJiraIssuePreviewContent("missing")).resolves.toEqual({ status: "error", body: null, comments: [] });

    vi.mocked(commands.jiraIssuePreviewContent).mockRejectedValueOnce(new Error("boom"));
    await expect(loadJiraIssuePreviewContent("wi_amp_1043")).resolves.toEqual({ status: "error", body: null, comments: [] });
  });
});
