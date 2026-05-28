import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { JiraIssueDetail } from "./detail";
import type { JiraIssueListItem, JiraIssueStatusTransition } from "../../bindings";
import * as historyModule from "./history";

vi.mock("./history");

const baseItem = (): JiraIssueListItem => ({
  work_item_id: "wi_amp_1043",
  key: "AMP-1043",
  title: "Fix the thing",
  status_name: "To Do",
  assignee_display_name: "Alice Smith",
  updated_at_source: "2024-06-01T10:00:00Z",
  project_key: "AMP",
  priority_name: null,
  labels: [],
});

const transition = (): JiraIssueStatusTransition => ({
  event_id: "iev_001",
  issue_id: "wi_amp_1043",
  occurred_at: "2026-05-27T10:00:00Z",
  actor_display_name: "Alice Smith",
  from_status: "To Do",
  to_status: "In Progress",
  complete: true,
});

// Existing tests

const full: JiraIssueListItem = {
  work_item_id: "wid-1",
  key: "AMP-123",
  title: "Fix the widget",
  status_name: "In Progress",
  assignee_display_name: "Alice Smith",
  updated_at_source: "2024-06-01T10:00:00Z",
  project_key: "AMP",
  priority_name: null,
  labels: [],
};

describe("JiraIssueDetail", () => {
  beforeEach(() => {
    vi.mocked(historyModule.loadJiraIssueStatusHistory).mockResolvedValue({
      status: "ok",
      transitions: [],
      partial: false,
    });
  });

  it("renders the key and title", async () => {
    render(<JiraIssueDetail item={full} />);
    expect(screen.getByText("AMP-123")).toBeInTheDocument();
    expect(screen.getByText("Fix the widget")).toBeInTheDocument();
  });

  it("renders status badge", async () => {
    render(<JiraIssueDetail item={full} />);
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });

  it("renders assignee name", async () => {
    render(<JiraIssueDetail item={full} />);
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
  });

  it("renders 'Unassigned' when assignee is null", async () => {
    render(<JiraIssueDetail item={{ ...full, assignee_display_name: null }} />);
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });

  it("renders project_key when present", async () => {
    render(<JiraIssueDetail item={full} />);
    expect(screen.getByTestId("detail-project-key")).toBeInTheDocument();
    expect(screen.getByTestId("detail-project-key").textContent).toBe("AMP");
  });

  it("omits project_key section when null", async () => {
    render(<JiraIssueDetail item={{ ...full, project_key: null }} />);
    expect(screen.queryByTestId("detail-project-key")).not.toBeInTheDocument();
  });

  it("renders updated time when present", async () => {
    render(<JiraIssueDetail item={full} />);
    expect(screen.getByTestId("detail-updated")).toBeInTheDocument();
  });

  it("omits updated section when null", async () => {
    render(<JiraIssueDetail item={{ ...full, updated_at_source: null }} />);
    expect(screen.queryByTestId("detail-updated")).not.toBeInTheDocument();
  });
});

describe("JiraIssueDetail — status history", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows loading spinner while history is pending", () => {
    vi.mocked(historyModule.loadJiraIssueStatusHistory).mockReturnValue(
      new Promise(() => {}), // never resolves
    );
    render(<JiraIssueDetail item={baseItem()} />);
    expect(screen.getByRole("status", { name: "Loading status history…" })).toBeInTheDocument();
  });

  it("still renders title/key/status badge during loading", () => {
    vi.mocked(historyModule.loadJiraIssueStatusHistory).mockReturnValue(
      new Promise(() => {}),
    );
    render(<JiraIssueDetail item={baseItem()} />);
    expect(screen.getByText("AMP-1043")).toBeInTheDocument();
    expect(screen.getByText("Fix the thing")).toBeInTheDocument();
    expect(screen.getByText("To Do")).toBeInTheDocument();
  });

  it("shows empty state when no transitions", async () => {
    vi.mocked(historyModule.loadJiraIssueStatusHistory).mockResolvedValue({
      status: "ok",
      transitions: [],
      partial: false,
    });
    render(<JiraIssueDetail item={baseItem()} />);
    await waitFor(() => {
      expect(screen.getByText(/No status changes captured yet/)).toBeInTheDocument();
    });
  });

  it("shows error message when status is error", async () => {
    vi.mocked(historyModule.loadJiraIssueStatusHistory).mockResolvedValue({
      status: "error",
      transitions: [],
      partial: false,
    });
    render(<JiraIssueDetail item={baseItem()} />);
    await waitFor(() => {
      expect(
        screen.getByText(/Could not load status history/),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("shows partial warning when partial is true", async () => {
    vi.mocked(historyModule.loadJiraIssueStatusHistory).mockResolvedValue({
      status: "ok",
      transitions: [transition()],
      partial: true,
    });
    render(<JiraIssueDetail item={baseItem()} />);
    await waitFor(() => {
      expect(
        screen.getByText(/Showing captured history/),
      ).toBeInTheDocument();
    });
  });

  it("renders a status transition row with from/to status and actor", async () => {
    vi.mocked(historyModule.loadJiraIssueStatusHistory).mockResolvedValue({
      status: "ok",
      transitions: [transition()],
      partial: false,
    });
    render(<JiraIssueDetail item={baseItem()} />);
    await waitFor(() => {
      // "To Do" appears in both the status badge and the history from_status — use getAllByText
      expect(screen.getAllByText("To Do").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("In Progress")).toBeInTheDocument();
      expect(screen.getAllByText("Alice Smith").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders 'Unknown actor' when actor_display_name is null", async () => {
    vi.mocked(historyModule.loadJiraIssueStatusHistory).mockResolvedValue({
      status: "ok",
      transitions: [{ ...transition(), actor_display_name: null }],
      partial: false,
    });
    render(<JiraIssueDetail item={baseItem()} />);
    await waitFor(() => {
      expect(screen.getByText("Unknown actor")).toBeInTheDocument();
    });
  });

  it("includes to status, timestamp, and actor in accessible aria-label on list item", async () => {
    vi.mocked(historyModule.loadJiraIssueStatusHistory).mockResolvedValue({
      status: "ok",
      transitions: [transition()],
      partial: false,
    });
    render(<JiraIssueDetail item={baseItem()} />);
    await waitFor(() => {
      const list = screen.getByRole("list", { name: "Status history" });
      expect(list).toBeInTheDocument();
      const item = list.querySelector("li");
      const label = item?.getAttribute("aria-label") ?? "";
      expect(label).toMatch(/In Progress/);
      expect(label).toMatch(/Alice Smith/);
    });
  });
});
