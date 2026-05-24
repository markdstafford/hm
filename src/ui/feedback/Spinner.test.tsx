import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Spinner } from "./Spinner";

describe("Spinner", () => {
  it("renders with role status when label set", () => {
    render(<Spinner label="Loading" />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });
  it("has no axe violations", async () => {
    const { container } = render(<Spinner label="Loading" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
