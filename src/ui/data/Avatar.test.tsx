import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Avatar } from "./Avatar";

describe("Avatar", () => {
  it("renders the initial", () => {
    render(<Avatar initial="P" />);
    expect(screen.getByText("P")).toBeInTheDocument();
  });
  it("renders an image when src provided", () => {
    render(<Avatar src="x.png" alt="Person" />);
    expect(screen.getByRole("img", { name: "Person" })).toBeInTheDocument();
  });
  it("has no axe violations", async () => {
    const { container } = render(<Avatar initial="P" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
