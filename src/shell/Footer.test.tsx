import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Footer } from "./Footer";

describe("Footer", () => {
  it("renders three zones", () => {
    render(
      <Footer
        left={<span>L</span>}
        center={<span>C</span>}
        right={<span>R</span>}
        sidebarVisible
      />,
    );
    expect(screen.getByText("L")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
    expect(screen.getByText("R")).toBeInTheDocument();
  });
  it("has no axe violations", async () => {
    const { container } = render(<Footer left={<span />} center={<span />} right={<span />} sidebarVisible />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
