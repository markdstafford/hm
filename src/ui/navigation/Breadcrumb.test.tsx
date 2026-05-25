import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Breadcrumb } from "./Breadcrumb";

describe("Breadcrumb", () => {
  it("renders all items", () => {
    render(<Breadcrumb items={[{ label: "Workspace", href: "#" }, { label: "Inbox", isCurrent: true }]} />);
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("Inbox")).toBeInTheDocument();
  });
  it("marks the current item with aria-current", () => {
    render(<Breadcrumb items={[{ label: "Inbox", isCurrent: true }]} />);
    expect(screen.getByText("Inbox").closest("[aria-current]")).toHaveAttribute("aria-current", "page");
  });
  it("has no axe violations", async () => {
    const { container } = render(<Breadcrumb items={[{ label: "Inbox", isCurrent: true }]} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
