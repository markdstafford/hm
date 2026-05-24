import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { InboxPage } from "./InboxPage";

describe("InboxPage", () => {
  it("renders a breadcrumb and the empty state", () => {
    render(<>{InboxPage.titleBar} {InboxPage.content}</>);
    expect(screen.getByText("Inbox")).toBeInTheDocument();
    expect(screen.getByText(/Inbox is clear/i)).toBeInTheDocument();
  });
  it("has no axe violations", async () => {
    const { container } = render(<>{InboxPage.titleBar} {InboxPage.content}</>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
