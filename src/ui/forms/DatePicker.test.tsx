import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { DatePicker } from "./DatePicker";

const fixedToday = new Date(2026, 4, 27, 9, 30, 0);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
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

  it("opens to the selected month and navigates previous and next months", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<DatePicker aria-label="Updated date" value="2026-05-27" onChange={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Updated date" }));
    expect(screen.getByRole("grid", { name: "May 2026" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByRole("grid", { name: "April 2026" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByRole("grid", { name: "May 2026" })).toBeInTheDocument();
  });

  it("opens to today's month when value is null", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<DatePicker aria-label="Updated date" value={null} onChange={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Updated date" }));

    expect(screen.getByRole("grid", { name: "May 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "May 27, 2026, today" })).toBeInTheDocument();
  });

  it("selects a clicked day, emits YYYY-MM-DD, closes, and returns focus", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onChange = vi.fn();
    render(<DatePicker aria-label="Updated date" value={null} onChange={onChange} />);

    const trigger = screen.getByRole("button", { name: "Updated date" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "May 15, 2026" }));

    expect(onChange).toHaveBeenCalledWith("2026-05-15");
    expect(screen.queryByRole("grid", { name: "May 2026" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("selecting the already selected day emits the same value and closes", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onChange = vi.fn();
    render(<DatePicker aria-label="Updated date" value="2026-05-27" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Updated date" }));
    await user.click(screen.getByRole("button", { name: "May 27, 2026, selected, today" }));

    expect(onChange).toHaveBeenCalledWith("2026-05-27");
    expect(screen.queryByRole("grid", { name: "May 2026" })).not.toBeInTheDocument();
  });

  it("shows Clear only when value is non-null and emits null", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onChange = vi.fn();
    render(<DatePicker aria-label="Updated date" value="2026-05-27" onChange={onChange} />);

    const trigger = screen.getByRole("button", { name: "Updated date" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Clear date" }));

    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.queryByRole("button", { name: "Clear date" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("hides Clear when value is null", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<DatePicker aria-label="Updated date" value={null} onChange={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Updated date" }));

    expect(screen.queryByRole("button", { name: "Clear date" })).not.toBeInTheDocument();
  });

  it("honors minDate and maxDate by disabling out-of-bound days", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onChange = vi.fn();
    render(
      <DatePicker
        aria-label="Updated date"
        value="2026-05-15"
        onChange={onChange}
        minDate="2026-05-10"
        maxDate="2026-05-20"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Updated date" }));

    expect(screen.getByRole("button", { name: "May 9, 2026, unavailable" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "May 21, 2026, unavailable" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "May 9, 2026, unavailable" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("opens from keyboard, moves focused day with arrows, and selects with Enter", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onChange = vi.fn();
    render(<DatePicker aria-label="Updated date" value="2026-05-27" onChange={onChange} />);

    await user.tab();
    expect(screen.getByRole("button", { name: "Updated date" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "May 27, 2026, selected, today" })).toHaveFocus();

    await user.keyboard("{ArrowRight}{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("2026-06-04");
    expect(screen.queryByRole("grid", { name: "June 2026" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Updated date" })).toHaveFocus();
  });

  it("closes with Escape without emitting a value and returns focus", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onChange = vi.fn();
    render(<DatePicker aria-label="Updated date" value="2026-05-27" onChange={onChange} />);

    const trigger = screen.getByRole("button", { name: "Updated date" });
    await user.click(trigger);
    expect(screen.getByRole("grid", { name: "May 2026" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("grid", { name: "May 2026" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("has labelled calendar controls and no axe violations while open", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = render(
      <DatePicker
        aria-label="Updated date"
        value="2026-05-27"
        onChange={() => {}}
        minDate="2026-05-10"
        maxDate="2026-06-10"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Updated date" }));

    expect(screen.getByRole("button", { name: "Previous month" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next month" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear date" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
