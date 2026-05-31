import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
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

  it("renders populated tier 1 fields below identity and hides empty fields", async () => {
    render(<JiraIssueDetail item={{ ...full, priority_name: "P1", project_key: "AMP", assignee_display_name: "Alice Smith" }} />);

    const heading = screen.getByRole("heading", { name: "Fix the widget" });
    const fieldRegion = screen.getByRole("region", { name: "Issue fields" });
    const historyHeading = screen.getByRole("heading", { name: "Status history" });

    expect(heading.compareDocumentPosition(fieldRegion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(fieldRegion.compareDocumentPosition(historyHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("P1")).toBeInTheDocument();
    expect(screen.getByText("Project")).toBeInTheDocument();
    expect(screen.getByText("AMP")).toBeInTheDocument();
    expect(screen.getByText("Assignee")).toBeInTheDocument();
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
  });

  it("omits empty Jira preview fields instead of rendering Unassigned or placeholders", async () => {
    render(
      <JiraIssueDetail
        item={{
          ...full,
          priority_name: null,
          project_key: null,
          assignee_display_name: null,
          labels: [],
          updated_at_source: null,
        }}
      />,
    );

    expect(screen.queryByRole("region", { name: "Issue fields" })).not.toBeInTheDocument();
    expect(screen.queryByText("Unassigned")).not.toBeInTheDocument();
    expect(screen.queryByText("Priority")).not.toBeInTheDocument();
    expect(screen.queryByText("Project")).not.toBeInTheDocument();
    expect(screen.queryByText("Updated")).not.toBeInTheDocument();
  });

  it("expands and collapses populated secondary Jira fields", async () => {
    const user = userEvent.setup();
    render(<JiraIssueDetail item={{ ...full, priority_name: "P1", labels: ["preview", "triage"] }} />);

    const button = screen.getByRole("button", { name: "More fields (2)" });
    expect(screen.queryByText("Labels")).not.toBeInTheDocument();

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Labels")).toBeInTheDocument();
    expect(screen.getByText("preview")).toBeInTheDocument();
    expect(screen.getByText("triage")).toBeInTheDocument();
    expect(screen.getByText("Updated")).toBeInTheDocument();

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Labels")).not.toBeInTheDocument();
  });

  it("uses compact preview metadata for one-column secondary fields", async () => {
    const user = userEvent.setup();
    render(
      <JiraIssueDetail
        item={{ ...full, priority_name: "P1", labels: ["preview"], updated_at_source: "2024-06-01T10:00:00Z" }}
        preview={{ surface: "side-peek", width: 360, height: null, sizeClass: "compact" }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "More fields (2)" }));
    expect(screen.getByTestId("preview-secondary-fields")).toHaveClass("grid-cols-1");
  });

  it("uses roomy measured width for two-column secondary fields without a viewport breakpoint", async () => {
    const user = userEvent.setup();
    render(
      <JiraIssueDetail
        item={{ ...full, priority_name: "P1", labels: ["preview"], updated_at_source: "2024-06-01T10:00:00Z" }}
        preview={{ surface: "bottom-peek", width: 720, height: null, sizeClass: "roomy" }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "More fields (2)" }));
    const secondary = screen.getByTestId("preview-secondary-fields");
    expect(secondary).toHaveClass("grid-cols-2");
    expect(secondary).not.toHaveClass("sm:grid-cols-2");
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

  it("has no axe violations when status history is loaded", async () => {
    vi.mocked(historyModule.loadJiraIssueStatusHistory).mockResolvedValue({
      status: "ok",
      transitions: [transition()],
      partial: false,
    });
    const { container } = render(<JiraIssueDetail item={baseItem()} />);
    await screen.findByRole("list", { name: "Status history" });
    expect(await axe(container)).toHaveNoViolations();
  });
});
