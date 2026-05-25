import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { KeyboardShortcut } from "./KeyboardShortcut";

describe("KeyboardShortcut", () => {
  it("renders a combo on mac as glyphs", () => {
    render(<KeyboardShortcut binding="⌘+shift+d" platform="mac" />);
    expect(screen.getByText("⌘⇧D")).toBeInTheDocument();
  });
  it("renders a sequence as joined kbd elements", () => {
    render(<KeyboardShortcut binding={["g", "i"]} platform="mac" />);
    expect(screen.getByText("G")).toBeInTheDocument();
    expect(screen.getByText("I")).toBeInTheDocument();
  });
  it("has no axe violations", async () => {
    const { container } = render(<KeyboardShortcut binding="?" platform="mac" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
