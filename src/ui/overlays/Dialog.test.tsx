import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { Dialog } from "./Dialog";

describe("Dialog", () => {
  it("opens and renders title and description", async () => {
    const user = userEvent.setup();
    render(
      <Dialog.Root>
        <Dialog.Trigger asChild><button>Open</button></Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Title>Title</Dialog.Title>
          <Dialog.Description>Desc</Dialog.Description>
          <Dialog.Close asChild><button>Close</button></Dialog.Close>
        </Dialog.Content>
      </Dialog.Root>,
    );
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
  });
  it("has no axe violations when closed", async () => {
    const { container } = render(
      <Dialog.Root>
        <Dialog.Trigger asChild><button>Open</button></Dialog.Trigger>
      </Dialog.Root>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
