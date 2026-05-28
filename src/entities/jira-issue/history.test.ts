import { describe, it, expect, vi, beforeEach } from "vitest";
import { commands } from "../../bindings";
import { loadJiraIssueStatusHistory } from "./history";

vi.mock("../../bindings", () => ({
  commands: {
    jiraIssueStatusTimeline: vi.fn(),
  },
}));

function statusTransition(): import("../../bindings").JiraIssueStatusTransition {
  return {
    event_id: "iev_test_001",
    issue_id: "wi_amp_1043",
    occurred_at: "2026-05-27T10:00:00Z",
    actor_display_name: "Alice Smith",
    from_status: "To Do",
    to_status: "In Progress",
    complete: true,
  };
}

describe("loadJiraIssueStatusHistory", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns command data in desktop/Tauri", async () => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    vi.mocked(commands.jiraIssueStatusTimeline).mockResolvedValue([statusTransition()]);
    const result = await loadJiraIssueStatusHistory("wi_amp_1043");
    expect(result).toMatchObject({ status: "ok", partial: false });
    expect((result as { transitions: unknown[] }).transitions).toHaveLength(1);
  });

  it("returns an empty browser fallback outside Tauri", async () => {
    delete (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    const result = await loadJiraIssueStatusHistory("wi_amp_1043");
    expect(result).toEqual({ status: "ok", transitions: [], partial: false });
    expect(commands.jiraIssueStatusTimeline).not.toHaveBeenCalled();
  });

  it("maps command failures to an error state", async () => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    vi.mocked(commands.jiraIssueStatusTimeline).mockRejectedValue(new Error("safe test failure"));
    const result = await loadJiraIssueStatusHistory("wi_amp_1043");
    expect(result).toEqual({ status: "error", transitions: [], partial: false });
  });
});
