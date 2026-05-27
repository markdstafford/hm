import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ChipContextMenu } from "./ChipContextMenu";
import type { CollectionView } from "./views/types";

beforeAll(() => {
  (globalThis as any).PointerEvent = window.MouseEvent;
  if (!window.HTMLElement.prototype.hasPointerCapture) window.HTMLElement.prototype.hasPointerCapture = () => false;
  if (!window.HTMLElement.prototype.releasePointerCapture) window.HTMLElement.prototype.releasePointerCapture = () => {};
  if (!window.HTMLElement.prototype.setPointerCapture) window.HTMLElement.prototype.setPointerCapture = () => {};
});

const view: CollectionView = {
  id: "mine",
  entityKind: "jira-issue",
  displayName: "Mine",
  position: 1,
  isDefault: true,
  config: {},
};

function renderMenu(handlers = {}) {
  return render(
    <ChipContextMenu
      view={view}
      onRename={vi.fn()}
      onDuplicate={vi.fn()}
      onDelete={vi.fn()}
      {...handlers}
    >
      <button type="button">Mine</button>
    </ChipContextMenu>,
  );
}

describe("ChipContextMenu", () => {
  it("opens menu with Rename, Duplicate, and Delete in order", async () => {
    renderMenu();
    fireEvent.contextMenu(screen.getByRole("button", { name: "Mine" }));
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["Rename", "Duplicate", "Delete"]);
  });

  it("commits a rename from an accessible dialog", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    renderMenu({ onRename });
    fireEvent.contextMenu(screen.getByRole("button", { name: "Mine" }));
    await user.click(await screen.findByRole("menuitem", { name: "Rename" }));
    const input = await screen.findByLabelText(/view name/i);
    await user.clear(input);
    await user.type(input, "Tarek scratch");
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(onRename).toHaveBeenCalledWith("mine", "Tarek scratch");
  });

  it("does not commit blank rename", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    renderMenu({ onRename });
    fireEvent.contextMenu(screen.getByRole("button", { name: "Mine" }));
    await user.click(await screen.findByRole("menuitem", { name: "Rename" }));
    const input = await screen.findByLabelText(/view name/i);
    await user.clear(input);
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByText(/enter a view name/i)).toBeInTheDocument();
  });

  it("calls duplicate immediately", async () => {
    const onDuplicate = vi.fn();
    renderMenu({ onDuplicate });
    fireEvent.contextMenu(screen.getByRole("button", { name: "Mine" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Duplicate" }));
    expect(onDuplicate).toHaveBeenCalledWith("mine");
  });

  it("requires confirmation before delete", async () => {
    const onDelete = vi.fn();
    renderMenu({ onDelete });
    fireEvent.contextMenu(screen.getByRole("button", { name: "Mine" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: /delete view/i }));
    expect(onDelete).toHaveBeenCalledWith("mine");
  });

  it("supports accessible rendering", async () => {
    const { container } = renderMenu();
    expect(await axe(container)).toHaveNoViolations();
  });
});
