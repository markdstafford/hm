import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { ConfidenceChip } from "./ConfidenceChip";

describe("ConfidenceChip", () => {
  it("renders value as a rounded percent", () => {
    render(<ConfidenceChip value={92.4} />);
    expect(screen.getByText("92%")).toBeInTheDocument();
  });

  it("clamps low values to zero", () => {
    render(<ConfidenceChip value={-20} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("clamps high values to one hundred", () => {
    render(<ConfidenceChip value={140} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("uses secondary-highlight tokens instead of primary tokens", () => {
    render(<ConfidenceChip value={92} />);
    const chip = screen.getByText("92%").closest("[data-confidence]");
    expect(chip).toHaveAttribute("data-confidence", "high");
    expect(chip?.className).not.toContain("text-primary");
    expect(chip?.className).not.toContain("bg-primary");
  });

  it("keeps low values in the same secondary-highlight treatment", () => {
    render(<ConfidenceChip value={50} />);
    const chip = screen.getByText("50%").closest("[data-confidence]");
    expect(chip).toHaveAttribute("data-confidence", "low");
    expect(chip?.className).not.toContain("text-primary");
    expect(chip?.className).not.toContain("bg-primary");
  });

  it("has no axe violations", async () => {
    const { container } = render(<ConfidenceChip value={92} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
