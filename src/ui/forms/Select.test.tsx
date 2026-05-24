import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Select } from "./Select";

describe("Select", () => {
  it("renders trigger with current value label", () => {
    render(
      <Select aria-label="Theme" defaultValue="a" options={[{ value: "a", label: "Apple" }, { value: "b", label: "Banana" }]} />
    );
    expect(screen.getByRole("combobox", { name: "Theme" })).toHaveTextContent("Apple");
  });
  it("has no axe violations", async () => {
    const { container } = render(
      <Select aria-label="Theme" defaultValue="a" options={[{ value: "a", label: "Apple" }]} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
