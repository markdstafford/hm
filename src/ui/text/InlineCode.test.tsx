import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { InlineCode } from "./InlineCode";

describe("InlineCode", () => {
  it("renders a <code> with mono font", () => {
    render(<InlineCode>foo</InlineCode>);
    expect(screen.getByText("foo").tagName).toBe("CODE");
  });
  it("has no axe violations", async () => {
    const { container } = render(<InlineCode>foo</InlineCode>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
