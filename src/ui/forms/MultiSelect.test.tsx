import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { MultiSelect } from "./MultiSelect";

describe("MultiSelect", () => {
  it("opens panel and toggles values", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MultiSelect
        aria-label="Projects"
        options={[{ value: "p1", label: "P1" }, { value: "p2", label: "P2" }]}
        value={[]}
        onChange={onChange}
      />
    );
    await user.click(screen.getByRole("button", { name: /Projects/ }));
    await user.click(await screen.findByRole("checkbox", { name: "P1" }));
    expect(onChange).toHaveBeenCalledWith(["p1"]);
  });
  it("has no axe violations", async () => {
    const { container } = render(
      <MultiSelect aria-label="Projects" options={[{ value: "p1", label: "P1" }]} value={[]} onChange={() => {}} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
