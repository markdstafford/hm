import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { SentimentBadge } from "./SentimentBadge";

describe("SentimentBadge", () => {
  it.each([
    ["good" as const, "Good"],
    ["ok" as const, "Ok"],
    ["bad" as const, "Bad"],
  ])("renders %s tone with visible text", (tone, label) => {
    render(<SentimentBadge tone={tone}>{label}</SentimentBadge>);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each([
    ["good" as const],
    ["ok" as const],
    ["bad" as const],
  ])("does not use primary or secondary-highlight classes for %s", (tone) => {
    render(<SentimentBadge tone={tone}>Label</SentimentBadge>);
    const badge = screen.getByText("Label");
    expect(badge.className).not.toContain("primary");
    expect(badge.className).not.toContain("secondary-highlight");
  });

  it("supports an accessible label when visual text is compact", () => {
    render(<SentimentBadge tone="bad" aria-label="Bad status">Bad</SentimentBadge>);
    expect(screen.getByLabelText("Bad status")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<SentimentBadge tone="good">Good</SentimentBadge>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
