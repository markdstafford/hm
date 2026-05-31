import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { PreviewDescription } from "./PreviewDescription";

function mockDescriptionMeasurements({ scrollHeight, clientHeight }: { scrollHeight: number; clientHeight: number }) {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get() {
      return scrollHeight;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get() {
      return clientHeight;
    },
  });
}

describe("PreviewDescription", () => {
  beforeEach(() => {
    mockDescriptionMeasurements({ scrollHeight: 40, clientHeight: 80 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([null, undefined, "", "   \n  "])("renders muted No description for empty body %#", (body) => {
    render(<PreviewDescription body={body} />);

    expect(screen.getByRole("heading", { name: "Description" })).toBeInTheDocument();
    expect(screen.getByText("No description")).toHaveClass("text-subtext");
    expect(screen.queryByRole("button", { name: /Show/ })).not.toBeInTheDocument();
  });

  it("renders populated Markdown without a no-op toggle when content does not overflow", () => {
    render(<PreviewDescription body={"## Repro steps\n\nVisit [site](https://example.com)."} />);

    expect(screen.getByRole("heading", { name: "Description" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Repro steps" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /site/i })).toHaveAttribute("href", "https://example.com");
    expect(screen.queryByRole("button", { name: /Show more|Show less/ })).not.toBeInTheDocument();
  });

  it("shows Show more only for overflowing collapsed content and toggles to Show less", async () => {
    const user = userEvent.setup();
    mockDescriptionMeasurements({ scrollHeight: 240, clientHeight: 80 });
    render(<PreviewDescription body={"Long body\n\n".repeat(20)} />);

    const showMore = await screen.findByRole("button", { name: "Show more" });
    expect(showMore).toHaveAttribute("aria-expanded", "false");

    await user.click(showMore);

    const showLess = screen.getByRole("button", { name: "Show less" });
    expect(showLess).toHaveAttribute("aria-expanded", "true");
    expect(showLess).toHaveFocus();

    await user.click(showLess);

    expect(screen.getByRole("button", { name: "Show more" })).toHaveAttribute("aria-expanded", "false");
  });

  it("resets expanded state and overflow state when resetKey changes", async () => {
    const user = userEvent.setup();
    mockDescriptionMeasurements({ scrollHeight: 240, clientHeight: 80 });
    const { rerender } = render(<PreviewDescription body={"Long body\n\n".repeat(20)} resetKey="one" />);

    await user.click(await screen.findByRole("button", { name: "Show more" }));
    expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument();

    mockDescriptionMeasurements({ scrollHeight: 40, clientHeight: 80 });
    rerender(<PreviewDescription body="Short body" resetKey="two" />);

    expect(screen.queryByRole("button", { name: /Show more|Show less/ })).not.toBeInTheDocument();
    expect(screen.getByText("Short body")).toBeInTheDocument();
  });

  it("has no axe violations when collapsed or expanded", async () => {
    const user = userEvent.setup();
    mockDescriptionMeasurements({ scrollHeight: 240, clientHeight: 80 });
    const { container } = render(<PreviewDescription body={"Long body\n\n".repeat(20)} />);

    expect(await axe(container)).toHaveNoViolations();
    await user.click(await screen.findByRole("button", { name: "Show more" }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
