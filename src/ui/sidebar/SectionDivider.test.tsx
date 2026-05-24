import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { SectionDivider } from "./SectionDivider";

describe("SectionDivider", () => {
  it("renders a separator role", () => {
    const { container } = render(<SectionDivider />);
    expect(container.querySelector('[role="separator"]')).toBeTruthy();
  });
  it("has no axe violations", async () => {
    const { container } = render(<SectionDivider />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
