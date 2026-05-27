import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { Popover } from "./Popover";

describe("Popover", () => {
  it("opens on trigger click", async () => {
    const user = userEvent.setup();
    render(<Popover trigger={<button>Open</button>}><div>Body</div></Popover>);
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByText("Body")).toBeInTheDocument();
  });
  it("has no axe violations", async () => {
    const { container } = render(<Popover trigger={<button>Open</button>}><div>Body</div></Popover>);
    expect(await axe(container)).toHaveNoViolations();
  });
  it("supports controlled open state", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = React.useState(false);
      return (
        <Popover open={open} onOpenChange={setOpen} trigger={<button>Open</button>}>
          <button onClick={() => setOpen(false)}>Close body</button>
        </Popover>
      );
    }
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("button", { name: "Close body" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close body" }));
    expect(screen.queryByRole("button", { name: "Close body" })).not.toBeInTheDocument();
  });
  it("allows a custom content class", async () => {
    const user = userEvent.setup();
    render(<Popover trigger={<button>Open</button>} contentClassName="w-80"><div>Body</div></Popover>);
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByText("Body").parentElement?.className).toContain("w-80");
  });
});
