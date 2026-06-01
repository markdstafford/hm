import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { ScopeHeader } from "./ScopeHeader";

describe("ScopeHeader", () => {
  it("renders the scope name", () => {
    render(<ScopeHeader name="Personal" />);
    expect(screen.getByText("Personal")).toBeInTheDocument();
  });

  it("enables search when an opener is provided", async () => {
    const user = userEvent.setup();
    const onOpenSearch = vi.fn();
    render(<ScopeHeader name="Personal" onOpenSearch={onOpenSearch} />);
    await user.click(screen.getByRole("button", { name: "Search items" }));
    expect(onOpenSearch).toHaveBeenCalledOnce();
  });

  it("keeps search visibly disabled when no opener is provided", () => {
    render(<ScopeHeader name="Personal" />);
    expect(screen.getByRole("button", { name: "Search (coming soon)" })).toBeDisabled();
  });

  it("has no axe violations", async () => {
    const { container } = render(<ScopeHeader name="Personal" onOpenSearch={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
