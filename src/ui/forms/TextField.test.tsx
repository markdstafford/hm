import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { TextField } from "./TextField";

describe("TextField", () => {
  it("renders an input", () => {
    render(<TextField aria-label="Name" defaultValue="hi" />);
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("hi");
  });
  it("applies data-invalid when invalid", () => {
    render(<TextField aria-label="X" invalid />);
    expect(screen.getByRole("textbox")).toHaveAttribute("data-invalid", "true");
  });
  it("has no axe violations", async () => {
    const { container } = render(<TextField aria-label="Name" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
