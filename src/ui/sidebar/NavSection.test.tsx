import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { NavSection } from "./NavSection";
import { NavItem } from "./NavItem";

describe("NavSection", () => {
  it("renders label and children", () => {
    render(
      <NavSection label="Personal">
        <NavItem label="Inbox" />
      </NavSection>,
    );
    expect(screen.getByText("Personal")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Inbox/ })).toBeInTheDocument();
  });
  it("has no axe violations", async () => {
    const { container } = render(<NavSection label="Personal"><NavItem label="Inbox" /></NavSection>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
