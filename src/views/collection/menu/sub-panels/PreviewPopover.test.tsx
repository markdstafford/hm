import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreviewPopover, previewLabel } from "./PreviewPopover";
import type { PreviewSurface } from "../../ViewConfig";

beforeAll(() => {
  (globalThis as any).PointerEvent = window.MouseEvent;
  if (!window.HTMLElement.prototype.hasPointerCapture) window.HTMLElement.prototype.hasPointerCapture = () => false;
  if (!window.HTMLElement.prototype.releasePointerCapture) window.HTMLElement.prototype.releasePointerCapture = () => {};
  if (!window.HTMLElement.prototype.setPointerCapture) window.HTMLElement.prototype.setPointerCapture = () => {};
});

function renderPopover(current: PreviewSurface = "side-peek", onSelect = vi.fn()) {
  return render(
    <PreviewPopover
      current={current}
      onSelect={onSelect}
      trigger={<button type="button">Preview {previewLabel(current)}</button>}
    />,
  );
}

describe("PreviewPopover", () => {
  it("renders all preview options with descriptions after opening", async () => {
    const user = userEvent.setup();
    renderPopover();
    await user.click(screen.getByRole("button", { name: /preview side/i }));

    expect(screen.getByRole("option", { name: /side/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: /bottom/i })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("option", { name: /full page/i })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("Detail opens in a 440px right rail.")).toBeInTheDocument();
    expect(screen.getByText("Detail opens in a 280px bottom pane.")).toBeInTheDocument();
    expect(screen.getByText("Detail takes the whole content area.")).toBeInTheDocument();
  });

  it.each<PreviewSurface>(["side-peek", "bottom-peek", "full-page"])(
    "emits %s and closes popover after picking an option",
    async (preview) => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      renderPopover("side-peek", onSelect);
      await user.click(screen.getByRole("button", { name: /preview side/i }));
      await user.click(screen.getByRole("option", { name: new RegExp(previewLabel(preview), "i") }));

      expect(onSelect).toHaveBeenCalledWith(preview);
      await waitFor(() => {
        expect(screen.queryByRole("listbox", { name: "Preview options" })).not.toBeInTheDocument();
      });
    },
  );
});
