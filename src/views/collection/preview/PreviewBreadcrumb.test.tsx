import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PreviewBreadcrumb } from "./PreviewBreadcrumb";
import type { FocusTrailEntry } from "../navigation/types";

type Item = { id: string };

const trail: FocusTrailEntry<Item>[] = [
  { item: { id: "a" }, label: "AMP-1087" },
  { item: { id: "b" }, label: "AMP-1102" },
  { item: { id: "c" }, label: "PR #190" },
];

describe("PreviewBreadcrumb", () => {
  it("renders nothing for a one-item trail", () => {
    const { container } = render(<PreviewBreadcrumb trail={[trail[0]]} onPickCrumb={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders earlier crumbs as buttons and the current crumb as current text", () => {
    render(<PreviewBreadcrumb trail={trail} onPickCrumb={vi.fn()} />);
    expect(screen.getByRole("navigation", { name: "Preview focus path" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Return to AMP-1087" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Return to AMP-1102" })).toBeInTheDocument();
    expect(screen.getByText("PR #190")).toHaveAttribute("aria-current", "page");
  });

  it("calls onPickCrumb with the clicked earlier crumb index", () => {
    const onPickCrumb = vi.fn();
    render(<PreviewBreadcrumb trail={trail} onPickCrumb={onPickCrumb} />);
    fireEvent.click(screen.getByRole("button", { name: "Return to AMP-1102" }));
    expect(onPickCrumb).toHaveBeenCalledWith(1);
  });
});
