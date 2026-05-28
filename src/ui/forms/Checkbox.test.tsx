import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Checkbox } from "./Checkbox";

describe("Checkbox", () => {
  it("renders with label", () => {
    render(<Checkbox label="Agree" />);
    expect(screen.getByRole("checkbox", { name: "Agree" })).toBeInTheDocument();
  });
  it("has no axe violations", async () => {
    const { container } = render(<Checkbox label="Agree" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("can visually hide the label while preserving the accessible name", () => {
    render(<Checkbox label="Select AMP-1" hideLabelText />);

    expect(screen.getByRole("checkbox", { name: "Select AMP-1" })).toBeInTheDocument();
    expect(screen.getByText("Select AMP-1")).toHaveClass("sr-only");
  });
});
