import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Tooltip } from "./Tooltip";

describe("Tooltip", () => {
  it("renders the trigger child", () => {
    render(<Tooltip content="Hi"><button>T</button></Tooltip>);
    expect(screen.getByRole("button", { name: "T" })).toBeInTheDocument();
  });
  it("has no axe violations", async () => {
    const { container } = render(<Tooltip content="Hi"><button>T</button></Tooltip>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
