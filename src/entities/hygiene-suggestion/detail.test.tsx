import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import type { HygieneSuggestion } from "./types";
import { SuggestionDetail } from "./detail";

const duplicate: HygieneSuggestion = {
  id: "dup-1",
  category: "duplicate",
  action: "merge-as-duplicate",
  confidence: 94,
  rationale: "Same stack trace and duplicate title.",
  target: { key: "AMP-1149", title: "Search panel hangs in reports", status: "Open", assignee: "Tarek Hassan", updatedAt: "2026-05-19" },
  duplicateOf: { key: "AMP-1102", title: "Search panel hangs", status: "Open", assignee: null, updatedAt: "2026-05-12" },
};

const stale: HygieneSuggestion = {
  id: "stale-1",
  category: "stale",
  action: "close-as-resolved",
  confidence: 88,
  rationale: "No activity after release shipped.",
  target: { key: "AMP-1043", title: "Worker pool exits on empty queue on shutdown", status: "Open", assignee: "Priya Naidu", updatedAt: "2026-04-12" },
  lastActivityAt: "2026-04-12",
};

const enrichment: HygieneSuggestion = {
  id: "enrich-1",
  category: "enrichment",
  action: "enrich-title-and-body",
  confidence: 76,
  rationale: "Title is too thin for grooming.",
  target: { key: "AMP-1180", title: "bug", status: "Backlog", assignee: null, body: null },
  proposed: { title: "Crash on Settings source save", body: "## Steps to reproduce\n1. Add a Jira source\n2. Save", labels: ["bug", "P1"] },
};

describe("SuggestionDetail", () => {
  it("renders the shared header for all categories", () => {
    render(<SuggestionDetail item={duplicate} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(/AMP-1149.*Search panel hangs in reports/);
    expect(screen.getByText("Duplicate")).toBeInTheDocument();
    expect(screen.getByText("Merge as duplicate")).toBeInTheDocument();
    expect(screen.getByText("94%")).toBeInTheDocument();
  });

  it("renders duplicate issue cards side by side", () => {
    render(<SuggestionDetail item={duplicate} />);
    expect(screen.getByRole("heading", { name: "This issue" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Duplicate of" })).toBeInTheDocument();
    expect(screen.getByText("AMP-1102")).toBeInTheDocument();
    expect(screen.getByText(/Unassigned/)).toBeInTheDocument();
  });

  it("renders stale detail with last activity or unknown fallback", () => {
    render(<SuggestionDetail item={stale} />);
    expect(screen.getByText(/Last activity: 2026-04-12/)).toBeInTheDocument();
    expect(screen.getByText("No activity after release shipped.")).toBeInTheDocument();
  });

  it("renders enrichment original and proposed columns", () => {
    render(<SuggestionDetail item={enrichment} />);
    expect(screen.getByRole("heading", { name: "Original" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Proposed" })).toBeInTheDocument();
    expect(screen.getByText("No body yet")).toBeInTheDocument();
    expect(screen.getByText("Crash on Settings source save")).toBeInTheDocument();
    expect(screen.getByText("Labels: bug, P1")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<SuggestionDetail item={enrichment} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
