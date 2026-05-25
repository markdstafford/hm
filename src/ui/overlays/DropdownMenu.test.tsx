import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { DropdownMenu } from "./DropdownMenu";

describe("DropdownMenu", () => {
  it("opens and shows items", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild><button>More</button></DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item>One</DropdownMenu.Item>
          <DropdownMenu.Item>Two</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>,
    );
    await user.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByRole("menuitem", { name: "One" })).toBeInTheDocument();
  });
  it("has no axe violations", async () => {
    const { container } = render(
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild><button>More</button></DropdownMenu.Trigger>
      </DropdownMenu.Root>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
