import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { ScopeHeader } from "./ScopeHeader";

describe("ScopeHeader", () => {
  it("renders the scope name", () => {
    render(<ScopeHeader name="Personal" />);
    expect(screen.getByText("Personal")).toBeInTheDocument();
  });
  it("has no axe violations", async () => {
    const { container } = render(<ScopeHeader name="Personal" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
