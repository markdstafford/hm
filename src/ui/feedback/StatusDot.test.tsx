import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { StatusDot } from "./StatusDot";

describe("StatusDot", () => {
  it("renders with role status when label provided", () => {
    const { getByRole } = render(<StatusDot tone="green" label="Synced" />);
    expect(getByRole("status")).toBeInTheDocument();
  });
  it("has no axe violations", async () => {
    const { container } = render(<StatusDot tone="green" label="Synced" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
