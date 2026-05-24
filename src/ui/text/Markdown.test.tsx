import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Markdown } from "./Markdown";

describe("Markdown", () => {
  it("renders headings and links", () => {
    render(<Markdown source={"# Title\n\nVisit [site](https://example.com)."} />);
    expect(screen.getByRole("heading", { name: "Title", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "site" })).toBeInTheDocument();
  });
  it("renders image as italic placeholder", () => {
    render(<Markdown source={"![A cat](https://example.com/cat.png)"} />);
    expect(screen.getByText(/\[image: A cat\]/)).toBeInTheDocument();
  });
  it("has no axe violations", async () => {
    const { container } = render(<Markdown source={"# Title\n\nText."} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
