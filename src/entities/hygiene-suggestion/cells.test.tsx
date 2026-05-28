import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { HygieneSuggestion } from "./types";
import {
  ActionCell,
  AssigneeCell,
  CategoryCell,
  ConfidenceCell,
  KeyCell,
  StatusCell,
  TitleCell,
} from "./cells";

const duplicate: HygieneSuggestion = {
  id: "dup-1",
  category: "duplicate",
  action: "merge-as-duplicate",
  confidence: 92,
  rationale: "Same stack trace.",
  target: { key: "AMP-1149", title: "Search panel hangs", status: "Open", assignee: null },
  duplicateOf: { key: "AMP-1102", title: "Search panel hangs", status: "Open", assignee: "Tarek Hassan" },
};

describe("hygiene suggestion cells", () => {
  it("renders action labels with an icon for each action", () => {
    const actions: HygieneSuggestion["action"][] = [
      "close-as-resolved",
      "merge-as-duplicate",
      "reassign",
      "ping-for-context",
      "enrich-title-and-body",
    ];
    for (const action of actions) {
      const { unmount } = render(<ActionCell item={{ ...duplicate, action }} property="action" />);
      expect(screen.getByTestId(`hygiene-action-icon-${action}`)).toBeInTheDocument();
      unmount();
    }
    // Test that labels render correctly
    render(<ActionCell item={{ ...duplicate, action: "close-as-resolved" }} property="action" />);
    expect(screen.getByText("Close as resolved")).toBeInTheDocument();
  });

  it("renders duplicate key relationships as readable text", () => {
    render(<KeyCell item={duplicate} property="key" />);
    expect(screen.getByText("AMP-1149 → AMP-1102")).toBeInTheDocument();
  });

  it("renders category and confidence primitives", () => {
    render(<><CategoryCell item={duplicate} property="category" /><ConfidenceCell item={duplicate} property="confidence" /></>);
    expect(screen.getByText("Duplicate")).toBeInTheDocument();
    expect(screen.getByText("92%")).toBeInTheDocument();
  });

  it("renders title, assignee, and status fallbacks", () => {
    render(<><TitleCell item={duplicate} property="title" /><AssigneeCell item={duplicate} property="assignee" /><StatusCell item={{ ...duplicate, target: { ...duplicate.target, status: null } }} property="status" /></>);
    expect(screen.getByText("Search panel hangs")).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    expect(screen.getByText("No status")).toBeInTheDocument();
  });
});
