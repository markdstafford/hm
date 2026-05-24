import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Heading } from "./Heading";

describe("Heading", () => {
  it("renders the requested level", () => {
    render(<Heading level={2}>Title</Heading>);
    expect(screen.getByRole("heading", { name: "Title", level: 2 })).toBeInTheDocument();
  });
  it("has no axe violations", async () => {
    const { container } = render(<Heading level={1}>X</Heading>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
