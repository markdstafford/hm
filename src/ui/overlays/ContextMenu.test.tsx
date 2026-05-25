import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "jest-axe";
import { ContextMenu } from "./ContextMenu";

describe("ContextMenu", () => {
  it("opens on right-click", () => {
    render(
      <ContextMenu.Root>
        <ContextMenu.Trigger><div data-testid="row">Row</div></ContextMenu.Trigger>
        <ContextMenu.Content>
          <ContextMenu.Item>Copy</ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Root>,
    );
    fireEvent.contextMenu(screen.getByTestId("row"));
    expect(screen.getByRole("menuitem", { name: "Copy" })).toBeInTheDocument();
  });
  it("has no axe violations", async () => {
    const { container } = render(
      <ContextMenu.Root>
        <ContextMenu.Trigger><div>Row</div></ContextMenu.Trigger>
      </ContextMenu.Root>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
