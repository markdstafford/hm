import { render, screen } from "@testing-library/react";
import { KeyCell, TitleCell, StatusCell, AssigneeCell, UpdatedCell, PriorityCell, LabelsCell } from "./cells";
import type { JiraIssueListItem } from "../../bindings";

const base: JiraIssueListItem = {
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

describe("KeyCell", () => {
  it("renders the Jira key", () => {
    render(<KeyCell item={base} property="key" />);
    expect(screen.getByText("AMP-123")).toBeInTheDocument();
  });

  it("renders 'Unknown key' when key is falsy", () => {
    render(<KeyCell item={{ ...base, key: "" }} property="key" />);
    expect(screen.getByText("Unknown key")).toBeInTheDocument();
  });
});

describe("TitleCell", () => {
  it("renders the title", () => {
    render(<TitleCell item={base} property="title" />);
    expect(screen.getByText("Fix the widget")).toBeInTheDocument();
  });
});

describe("StatusCell", () => {
  it("renders a Badge with the status name", () => {
    render(<StatusCell item={base} property="status" />);
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });

  it("renders nothing when status_name is null", () => {
    const { container } = render(<StatusCell item={{ ...base, status_name: null }} property="status" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("AssigneeCell", () => {
  it("renders the display name when present", () => {
    render(<AssigneeCell item={base} property="assignee" />);
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
  });

  it("renders 'Unassigned' when assignee_display_name is null", () => {
    render(<AssigneeCell item={{ ...base, assignee_display_name: null }} property="assignee" />);
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });
});

describe("UpdatedCell", () => {
  it("renders a non-empty string for a parseable ISO date", () => {
    render(<UpdatedCell item={base} property="updated_at_source" />);
    const el = screen.getByTestId("updated-cell");
    expect(el.textContent).toBeTruthy();
  });

  it("renders the raw string when date is not parseable", () => {
    render(<UpdatedCell item={{ ...base, updated_at_source: "not-a-date" }} property="updated_at_source" />);
    expect(screen.getByTestId("updated-cell").textContent).toBe("not-a-date");
  });

  it("renders nothing when updated_at_source is null", () => {
    const { container } = render(<UpdatedCell item={{ ...base, updated_at_source: null }} property="updated_at_source" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("PriorityCell", () => {
  it("renders the priority name", () => {
    render(<PriorityCell item={{ ...base, priority_name: "High" }} property="priority" />);
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("renders nothing when priority_name is null", () => {
    const { container } = render(<PriorityCell item={{ ...base, priority_name: null }} property="priority" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("LabelsCell", () => {
  it("renders each label as a badge", () => {
    render(<LabelsCell item={{ ...base, labels: ["backend", "urgent"] }} property="labels" />);
    expect(screen.getByText("backend")).toBeInTheDocument();
    expect(screen.getByText("urgent")).toBeInTheDocument();
  });

  it("renders nothing when labels is empty", () => {
    const { container } = render(<LabelsCell item={{ ...base, labels: [] }} property="labels" />);
    expect(container).toBeEmptyDOMElement();
  });
});
