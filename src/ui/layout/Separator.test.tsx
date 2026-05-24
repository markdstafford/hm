import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Separator } from "./Separator";

describe("Separator", () => {
  it("renders horizontal by default", () => {
    const { container } = render(<Separator />);
    expect(container.querySelector("[data-orientation='horizontal']")).toBeInTheDocument();
  });
  it("renders vertical when orientation=vertical", () => {
    const { container } = render(<Separator orientation="vertical" />);
    expect(container.querySelector("[data-orientation='vertical']")).toBeInTheDocument();
  });
  it("exposes role=separator when not decorative", () => {
    render(<Separator decorative={false} />);
    expect(screen.getByRole("separator")).toHaveAttribute("data-orientation", "horizontal");
  });
  it("has no axe violations", async () => {
    const { container } = render(<Separator />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
