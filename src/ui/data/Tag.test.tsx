import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { Tag } from "./Tag";

describe("Tag", () => {
  it("calls onRemove when remove button clicked", async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    render(<Tag onRemove={onRemove}>tagA</Tag>);
    await user.click(screen.getByRole("button", { name: /Remove/ }));
    expect(onRemove).toHaveBeenCalled();
  });
  it("has no axe violations", async () => {
    const { container } = render(<Tag>tagA</Tag>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
