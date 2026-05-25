import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, it, expect, vi } from "vitest";
import { Card } from "./Card";

describe("Card", () => {
  it("renders children inside a bordered container", () => {
    render(<Card>hello</Card>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("renders as a button when interactive with an onClick", async () => {
    const onClick = vi.fn();
    render(
      <Card interactive aria-label="Pick a thing" onClick={onClick}>
        pick me
      </Card>,
    );
    const btn = screen.getByRole("button", { name: "Pick a thing" });
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders as a div by default", () => {
    render(<Card>plain</Card>);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("has no axe violations", async () => {
    const { container } = render(<Card>contents</Card>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
