import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { PreviewComments } from "./PreviewComments";
import type { PreviewComment } from "./commentsModel";

const comment = (overrides: Partial<PreviewComment>): PreviewComment => ({
  id: overrides.id ?? "comment",
  authorDisplayName: overrides.authorDisplayName ?? "Author",
  body: overrides.body ?? "Comment body",
  createdAtSource: overrides.createdAtSource ?? null,
  updatedAtSource: overrides.updatedAtSource ?? null,
  ingestedAt: overrides.ingestedAt ?? null,
});

describe("PreviewComments", () => {
  it("hides the region when there are zero comments", () => {
    render(<PreviewComments comments={[]} />);
    expect(screen.queryByRole("heading", { name: /Comments/ })).not.toBeInTheDocument();
  });

  it("renders one or two comments without a show-all toggle", () => {
    render(
      <PreviewComments
        comments={[
          comment({ id: "one", authorDisplayName: "Priya", body: "First", updatedAtSource: "2026-05-31T10:00:00Z" }),
          comment({ id: "two", authorDisplayName: "Tarek", body: "Second", updatedAtSource: "2026-05-30T10:00:00Z" }),
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Comments (2)" })).toBeInTheDocument();
    expect(screen.getByText("Priya")).toBeInTheDocument();
    expect(screen.getByText("Tarek")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Show all/ })).not.toBeInTheDocument();
  });

  it("shows the two newest comments by default and expands all comments newest first", async () => {
    const user = userEvent.setup();
    render(
      <PreviewComments
        comments={[
          comment({ id: "older", authorDisplayName: "Older", body: "Older body", updatedAtSource: "2026-05-29T10:00:00Z" }),
          comment({ id: "newest", authorDisplayName: "Newest", body: "Newest body", updatedAtSource: "2026-05-31T10:00:00Z" }),
          comment({ id: "middle", authorDisplayName: "Middle", body: "Middle body", updatedAtSource: "2026-05-30T10:00:00Z" }),
        ]}
      />,
    );

    const list = screen.getByRole("list", { name: "Comments" });
    expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("Newest"),
      expect.stringContaining("Middle"),
    ]);
    expect(screen.queryByText("Older body")).not.toBeInTheDocument();

    const showAll = screen.getByRole("button", { name: "Show all 3 comments" });
    expect(showAll).toHaveAttribute("aria-expanded", "false");
    await user.click(showAll);

    expect(showAll).toHaveFocus();
    expect(screen.getByRole("button", { name: "Show fewer" })).toHaveAttribute("aria-expanded", "true");
    expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("Newest"),
      expect.stringContaining("Middle"),
      expect.stringContaining("Older"),
    ]);

    await user.click(screen.getByRole("button", { name: "Show fewer" }));
    expect(screen.queryByText("Older body")).not.toBeInTheDocument();
  });

  it("renders author, date, Markdown body, and body fallback", () => {
    render(
      <PreviewComments
        comments={[
          comment({
            id: "fallbacks",
            authorDisplayName: "  ",
            body: "   ",
            createdAtSource: "2026-05-30T10:00:00Z",
          }),
          comment({
            id: "markdown",
            authorDisplayName: "Priya",
            body: "## Update\n\nVisit [docs](https://example.com).",
            updatedAtSource: "2026-05-31T10:00:00Z",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Unknown author")).toBeInTheDocument();
    expect(screen.getByText("No comment body")).toHaveClass("text-subtext");
    expect(screen.getByRole("heading", { name: "Update" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /docs/i })).toHaveAttribute("href", "https://example.com");
    expect(screen.getByText(new Date("2026-05-30T10:00:00Z").toLocaleString())).toBeInTheDocument();
  });

  it("resets expanded state when resetKey changes", async () => {
    const user = userEvent.setup();
    const comments = [
      comment({ id: "one", body: "One", updatedAtSource: "2026-05-31T10:00:00Z" }),
      comment({ id: "two", body: "Two", updatedAtSource: "2026-05-30T10:00:00Z" }),
      comment({ id: "three", body: "Three", updatedAtSource: "2026-05-29T10:00:00Z" }),
    ];
    const { rerender } = render(<PreviewComments comments={comments} resetKey="one" />);

    await user.click(screen.getByRole("button", { name: "Show all 3 comments" }));
    expect(screen.getByText("Three")).toBeInTheDocument();

    rerender(<PreviewComments comments={comments} resetKey="two" />);
    expect(screen.queryByText("Three")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show all 3 comments" })).toHaveAttribute("aria-expanded", "false");
  });

  it("has no axe violations when collapsed or expanded", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PreviewComments
        comments={[
          comment({ id: "one", body: "One", updatedAtSource: "2026-05-31T10:00:00Z" }),
          comment({ id: "two", body: "Two", updatedAtSource: "2026-05-30T10:00:00Z" }),
          comment({ id: "three", body: "Three", updatedAtSource: "2026-05-29T10:00:00Z" }),
        ]}
      />,
    );

    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole("button", { name: "Show all 3 comments" }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
