import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { AlertDialog } from "./AlertDialog";

describe("AlertDialog", () => {
  it("renders action and cancel", async () => {
    const user = userEvent.setup();
    render(
      <AlertDialog.Root>
        <AlertDialog.Trigger asChild><button>Delete</button></AlertDialog.Trigger>
        <AlertDialog.Content>
          <AlertDialog.Title>Confirm</AlertDialog.Title>
          <AlertDialog.Description>Sure?</AlertDialog.Description>
          <AlertDialog.Cancel asChild><button>No</button></AlertDialog.Cancel>
          <AlertDialog.Action asChild><button>Yes</button></AlertDialog.Action>
        </AlertDialog.Content>
      </AlertDialog.Root>,
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes" })).toBeInTheDocument();
  });
  it("has no axe violations when closed", async () => {
    const { container } = render(<AlertDialog.Root><AlertDialog.Trigger asChild><button>x</button></AlertDialog.Trigger></AlertDialog.Root>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
