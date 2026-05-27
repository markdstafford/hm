import { render, screen } from "@testing-library/react";
import { JiraIssueDetail } from "./detail";
import type { JiraIssueListItem } from "../../bindings";

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
  it("renders the key and title", () => {
    render(<JiraIssueDetail item={full} />);
    expect(screen.getByText("AMP-123")).toBeInTheDocument();
    expect(screen.getByText("Fix the widget")).toBeInTheDocument();
  });

  it("renders status badge", () => {
    render(<JiraIssueDetail item={full} />);
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });

  it("renders assignee name", () => {
    render(<JiraIssueDetail item={full} />);
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
  });

  it("renders 'Unassigned' when assignee is null", () => {
    render(<JiraIssueDetail item={{ ...full, assignee_display_name: null }} />);
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });

  it("renders project_key when present", () => {
    render(<JiraIssueDetail item={full} />);
    expect(screen.getByTestId("detail-project-key")).toBeInTheDocument();
    expect(screen.getByTestId("detail-project-key").textContent).toBe("AMP");
  });

  it("omits project_key section when null", () => {
    render(<JiraIssueDetail item={{ ...full, project_key: null }} />);
    expect(screen.queryByTestId("detail-project-key")).not.toBeInTheDocument();
  });

  it("renders updated time when present", () => {
    render(<JiraIssueDetail item={full} />);
    expect(screen.getByTestId("detail-updated")).toBeInTheDocument();
  });

  it("omits updated section when null", () => {
    render(<JiraIssueDetail item={{ ...full, updated_at_source: null }} />);
    expect(screen.queryByTestId("detail-updated")).not.toBeInTheDocument();
  });
});
