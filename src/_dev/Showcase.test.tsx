import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Showcase } from "./Showcase";

describe("Showcase", () => {
  it("renders all category headings", () => {
    render(<Showcase />);
    for (const h of ["Appearance (transient)", "Tokens", "Buttons", "Forms", "Overlays", "Navigation", "Sidebar", "Feedback", "Data", "Text", "Layout"]) {
      expect(screen.getByRole("heading", { name: h })).toBeInTheDocument();
    }
  });
  it("renders DatePicker showcase examples", () => {
    render(<Showcase />);

    expect(screen.getByRole("button", { name: "Showcase empty date" })).toHaveTextContent("Select date");
    expect(screen.getByRole("button", { name: "Showcase selected date" })).toHaveTextContent("May 27, 2026");
    expect(screen.getByRole("button", { name: "Showcase bounded date" })).toHaveTextContent("May 15, 2026");
    expect(screen.getByRole("button", { name: "Showcase disabled date" })).toBeDisabled();
  });
  it("has no axe violations", async () => {
    const { container } = render(<Showcase />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
