import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { SectionLabel } from "./SectionLabel";

describe("SectionLabel", () => {
  it("renders mixed-case children", () => {
    render(<SectionLabel>Personal</SectionLabel>);
    expect(screen.getByText("Personal")).toBeInTheDocument();
  });
  it("applies fontVariantCaps style", () => {
    render(<SectionLabel>Personal</SectionLabel>);
    expect(screen.getByText("Personal")).toHaveStyle({ fontVariantCaps: "all-small-caps" });
  });
  it("has no axe violations", async () => {
    const { container } = render(<SectionLabel>Personal</SectionLabel>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
