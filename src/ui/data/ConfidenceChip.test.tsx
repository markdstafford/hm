import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { ConfidenceChip } from "./ConfidenceChip";

describe("ConfidenceChip", () => {
  it("renders value as percent", () => {
    render(<ConfidenceChip value={92} />);
    expect(screen.getByText("92%")).toBeInTheDocument();
  });
  it("uses primary tone when >= 85", () => {
    render(<ConfidenceChip value={92} />);
    expect(screen.getByText("92%").closest("[data-confidence]")).toHaveAttribute("data-confidence", "high");
  });
  it("uses muted tone when < 85", () => {
    render(<ConfidenceChip value={50} />);
    expect(screen.getByText("50%").closest("[data-confidence]")).toHaveAttribute("data-confidence", "low");
  });
  it("has no axe violations", async () => {
    const { container } = render(<ConfidenceChip value={92} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
