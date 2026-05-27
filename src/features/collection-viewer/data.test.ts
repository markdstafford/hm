import { renderHook, waitFor } from "@testing-library/react";
import { useJiraIssues } from "./data";
import { commands } from "../../bindings";
import type { JiraIssueListItem } from "../../bindings";

vi.mock("../../bindings", () => ({
  commands: {
    jiraIssuesList: vi.fn(),
  },
}));

const mockIssue: JiraIssueListItem = {
  work_item_id: "w1",
  key: "AMP-1",
  title: "Test issue",
  status_name: "Open",
  assignee_display_name: "Bob",
  updated_at_source: "2024-01-01T00:00:00Z",
  project_key: "AMP",
  priority_name: null,
  labels: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

describe("useJiraIssues", () => {
  it("starts in loading state", () => {
    vi.mocked(commands.jiraIssuesList).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useJiraIssues());
    expect(result.current.loading).toBe(true);
    expect(result.current.issues).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("resolves issues on success", async () => {
    vi.mocked(commands.jiraIssuesList).mockResolvedValue({ status: "ok", data: [mockIssue] });
    const { result } = renderHook(() => useJiraIssues());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.issues).toEqual([mockIssue]);
    expect(result.current.error).toBeNull();
  });

  it("sets error on command failure", async () => {
    vi.mocked(commands.jiraIssuesList).mockResolvedValue({ status: "error", error: "DB error" });
    const { result } = renderHook(() => useJiraIssues());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("DB error");
    expect(result.current.issues).toEqual([]);
  });

  it("calls jiraIssuesList with the correct filter args", async () => {
    vi.mocked(commands.jiraIssuesList).mockResolvedValue({ status: "ok", data: [] });
    renderHook(() => useJiraIssues());
    await waitFor(() => {
      expect(commands.jiraIssuesList).toHaveBeenCalledWith({
        source_id: null,
        project_key: null,
        limit: 200,
      });
    });
  });
});
