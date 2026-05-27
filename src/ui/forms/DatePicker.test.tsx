import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { DatePicker } from "./DatePicker";

const fixedToday = new Date(2026, 4, 27, 9, 30, 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(fixedToday);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DatePicker", () => {
  it("renders a TextField-like trigger with placeholder text when value is null", () => {
    render(<DatePicker aria-label="Updated date" value={null} onChange={() => {}} />);

    const trigger = screen.getByRole("button", { name: "Updated date" });
    expect(trigger).toHaveTextContent("Select date");
    expect(trigger).toHaveClass("h-control-base");
    expect(trigger).toHaveClass("border-border");
    expect(trigger).toHaveClass("bg-background");
  });

  it("renders a deterministic display date for a selected ISO value", () => {
    render(<DatePicker aria-label="Created date" value="2026-05-27" onChange={() => {}} />);

    expect(screen.getByRole("button", { name: "Created date" })).toHaveTextContent("May 27, 2026");
  });

  it("uses a custom placeholder", () => {
    render(
      <DatePicker
        aria-label="Due date"
        value={null}
        onChange={() => {}}
        placeholder="Pick a due date"
      />,
    );

    expect(screen.getByRole("button", { name: "Due date" })).toHaveTextContent("Pick a due date");
  });

  it("does not crash or display invalid external values", () => {
    render(<DatePicker aria-label="Updated date" value="not-a-date" onChange={() => {}} />);

    expect(screen.getByRole("button", { name: "Updated date" })).toHaveTextContent("Select date");
  });

  it("blocks opening when disabled", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<DatePicker aria-label="Updated date" value="2026-05-27" onChange={() => {}} disabled />);

    const trigger = screen.getByRole("button", { name: "Updated date" });
    expect(trigger).toBeDisabled();

    await user.click(trigger);
    expect(screen.queryByRole("grid", { name: /May 2026/ })).not.toBeInTheDocument();
  });

  it("has no axe violations in empty and selected closed states", async () => {
    const empty = render(<DatePicker aria-label="Updated date" value={null} onChange={() => {}} />);
    expect(await axe(empty.container)).toHaveNoViolations();
    empty.unmount();

    const selected = render(<DatePicker aria-label="Updated date" value="2026-05-27" onChange={() => {}} />);
    expect(await axe(selected.container)).toHaveNoViolations();
  });
});
