import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders text", () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText("New")).toBeInTheDocument();
  });
  it("has no axe violations", async () => {
    const { container } = render(<Badge tone="green">OK</Badge>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
