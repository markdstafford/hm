import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Search } from "lucide-react";
import { IconButton } from "./IconButton";

describe("IconButton", () => {
  it("renders with aria-label from label prop", () => {
    render(<IconButton label="Open search"><Search size={14} /></IconButton>);
    expect(screen.getByRole("button", { name: "Open search" })).toBeInTheDocument();
  });
  it("applies data-active when active", () => {
    render(<IconButton label="On" active><Search size={14} /></IconButton>);
    expect(screen.getByRole("button")).toHaveAttribute("data-active", "true");
  });
  it("applies data-dimmed when dimmed", () => {
    render(<IconButton label="Off" dimmed><Search size={14} /></IconButton>);
    expect(screen.getByRole("button")).toHaveAttribute("data-dimmed", "true");
  });
  it("has no axe violations", async () => {
    const { container } = render(<IconButton label="Open search"><Search size={14} /></IconButton>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
