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
  it("has no axe violations", async () => {
    const { container } = render(<Showcase />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
