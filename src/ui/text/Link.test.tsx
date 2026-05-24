import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Link } from "./Link";

describe("Link", () => {
  it("renders an external link with target and rel", () => {
    render(<Link href="https://example.com">site</Link>);
    const a = screen.getByRole("link", { name: "site" });
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("rel", "noreferrer noopener");
  });
  it("renders an internal link without target", () => {
    render(<Link href="/inbox">inbox</Link>);
    const a = screen.getByRole("link", { name: "inbox" });
    expect(a).not.toHaveAttribute("target");
  });
  it("has no axe violations", async () => {
    const { container } = render(<Link href="https://example.com">site</Link>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
