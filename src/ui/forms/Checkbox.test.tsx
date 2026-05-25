import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Checkbox } from "./Checkbox";

describe("Checkbox", () => {
  it("renders with label", () => {
    render(<Checkbox label="Agree" />);
    expect(screen.getByRole("checkbox", { name: "Agree" })).toBeInTheDocument();
  });
  it("has no axe violations", async () => {
    const { container } = render(<Checkbox label="Agree" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
