import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Inbox } from "lucide-react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(<EmptyState icon={<Inbox size={24} />} title="No items" description="You're done." />);
    expect(screen.getByText("No items")).toBeInTheDocument();
    expect(screen.getByText("You're done.")).toBeInTheDocument();
  });
  it("has no axe violations", async () => {
    const { container } = render(<EmptyState icon={<Inbox size={24} />} title="No items" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
