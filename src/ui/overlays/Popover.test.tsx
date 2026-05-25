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
});
