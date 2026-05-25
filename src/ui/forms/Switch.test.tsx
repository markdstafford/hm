import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Switch } from "./Switch";

describe("Switch", () => {
  it("renders with label", () => {
    render(<Switch label="Notifications" />);
    expect(screen.getByRole("switch", { name: "Notifications" })).toBeInTheDocument();
  });
  it("has no axe violations", async () => {
    const { container } = render(<Switch label="Notifications" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
