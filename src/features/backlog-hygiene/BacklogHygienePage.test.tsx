import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { BacklogHygienePage } from "./BacklogHygienePage";

describe("BacklogHygienePage", () => {
  it("renders a breadcrumb and placeholder rows", () => {
    render(<>{BacklogHygienePage.titleBar} {BacklogHygienePage.header} {BacklogHygienePage.content}</>);
    expect(screen.getByText("Backlog hygiene")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
  });
  it("has no axe violations", async () => {
    const { container } = render(<>{BacklogHygienePage.titleBar} {BacklogHygienePage.header} {BacklogHygienePage.content}</>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
