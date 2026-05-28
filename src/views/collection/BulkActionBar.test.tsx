import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { Button } from "../../ui/buttons/Button";
import { BulkActionBar } from "./BulkActionBar";

describe("BulkActionBar", () => {
  it("renders nothing when count is zero", () => {
    const { container } = render(
      <BulkActionBar count={0} slots={{ primary: <Button>Approve</Button> }} onClear={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders selected count, slots in order, and clear control", () => {
    render(
      <BulkActionBar
        count={4}
        slots={{
          destructive: <Button variant="destructive">Reject</Button>,
          primary: <Button variant="primary">Approve 4</Button>,
          conditionalPrimary: <Button>Approve high 2</Button>,
        }}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByRole("toolbar", { name: "Bulk actions" })).toBeInTheDocument();
    expect(screen.getByText("4 selected")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Approve 4",
      "Approve high 2",
      "Reject",
      "",
    ]);
    expect(screen.getByRole("button", { name: "Clear selection" })).toBeInTheDocument();
  });

  it("renders custom extra slots after the canonical slots", () => {
    render(
      <BulkActionBar
        count={2}
        slots={{ secondary: <Button>Archive</Button>, primary: <Button>Approve 2</Button> }}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Approve 2",
      "Archive",
      "",
    ]);
  });

  it("calls onClear from the clear button", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<BulkActionBar count={1} slots={{}} onClear={onClear} />);

    await user.click(screen.getByRole("button", { name: "Clear selection" }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("has no axe violations when visible", async () => {
    const { container } = render(
      <BulkActionBar count={3} slots={{ primary: <Button>Approve 3</Button> }} onClear={vi.fn()} />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
