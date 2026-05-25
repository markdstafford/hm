import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { CodeBlock } from "./CodeBlock";

describe("CodeBlock", () => {
  it("renders the raw code as fallback", () => {
    render(<CodeBlock language="ts" code={"const x = 1;"} />);
    expect(screen.getByText(/const x = 1;/)).toBeInTheDocument();
  });
  it("has no axe violations", async () => {
    const { container } = render(<CodeBlock language="ts" code={"const x = 1;"} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
