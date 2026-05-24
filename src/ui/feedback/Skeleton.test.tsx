import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { Skeleton } from "./Skeleton";

describe("Skeleton", () => {
  it("renders with aria-hidden", () => {
    const { container } = render(<Skeleton width={120} height={12} />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });
  it("has no axe violations", async () => {
    const { container } = render(<Skeleton width={120} height={12} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
