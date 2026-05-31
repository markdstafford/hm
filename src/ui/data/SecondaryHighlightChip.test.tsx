import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { SecondaryHighlightChip } from "./SecondaryHighlightChip";

describe("SecondaryHighlightChip", () => {
  it("renders visible hint text", () => {
    render(<SecondaryHighlightChip>83% related</SecondaryHighlightChip>);
    expect(screen.getByText("83% related")).toBeInTheDocument();
  });

  it("uses the secondary-highlight token family", () => {
    render(<SecondaryHighlightChip>same project</SecondaryHighlightChip>);
    const chip = screen.getByText("same project");
    expect(chip.className).not.toContain("text-primary");
    expect(chip.className).not.toContain("bg-primary");
  });

  it("merges caller className", () => {
    render(<SecondaryHighlightChip className="ml-2">91% confidence</SecondaryHighlightChip>);
    expect(screen.getByText("91% confidence")).toHaveClass("ml-2");
  });

  it("has no axe violations", async () => {
    const { container } = render(<SecondaryHighlightChip>83% related</SecondaryHighlightChip>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
