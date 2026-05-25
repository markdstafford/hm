import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
  it("uses aria-disabled (not the native disabled attribute) so the tooltip trigger stays active", () => {
    render(<IconButton label="Coming soon" disabled><Search size={14} /></IconButton>);
    const btn = screen.getByRole("button", { name: "Coming soon" });
    expect(btn).toHaveAttribute("aria-disabled", "true");
    expect(btn).not.toHaveAttribute("disabled");
  });
  it("blocks onClick when disabled", () => {
    const onClick = vi.fn();
    render(<IconButton label="Coming soon" disabled onClick={onClick}><Search size={14} /></IconButton>);
    fireEvent.click(screen.getByRole("button", { name: "Coming soon" }));
    expect(onClick).not.toHaveBeenCalled();
  });
  it("has no axe violations", async () => {
    const { container } = render(<IconButton label="Open search"><Search size={14} /></IconButton>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
