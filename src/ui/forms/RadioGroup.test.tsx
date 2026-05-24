import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { RadioGroup } from "./RadioGroup";

describe("RadioGroup", () => {
  it("renders options", () => {
    render(
      <RadioGroup aria-label="Choose" defaultValue="a">
        <RadioGroup.Item value="a" label="A" />
        <RadioGroup.Item value="b" label="B" />
      </RadioGroup>,
    );
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });
  it("has no axe violations", async () => {
    const { container } = render(
      <RadioGroup aria-label="Choose" defaultValue="a">
        <RadioGroup.Item value="a" label="A" />
        <RadioGroup.Item value="b" label="B" />
      </RadioGroup>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
