import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { NavItem } from "./NavItem";

describe("NavItem", () => {
  it("renders label and count", () => {
    render(<NavItem label="Inbox" count={7} />);
    expect(screen.getByText("Inbox")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });
  it("marks active with aria-current", () => {
    render(<NavItem label="Inbox" active />);
    expect(screen.getByRole("button", { name: /Inbox/ })).toHaveAttribute("aria-current", "page");
  });
  it("has no axe violations", async () => {
    const { container } = render(<NavItem label="Inbox" count={0} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
