import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { GeneralCategory } from "./GeneralCategory";
import { DEFAULT_PREFERENCES } from "../../../preferences";

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).PointerEvent = window.MouseEvent;
  if (!window.HTMLElement.prototype.hasPointerCapture) {
    window.HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!window.HTMLElement.prototype.releasePointerCapture) {
    window.HTMLElement.prototype.releasePointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.setPointerCapture) {
    window.HTMLElement.prototype.setPointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }
});

describe("GeneralCategory", () => {
  it("renders the UI font and code font setting rows", () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<GeneralCategory prefs={DEFAULT_PREFERENCES} onUpdatePreferences={onUpdate} />);
    expect(screen.getByText("UI font")).toBeInTheDocument();
    expect(screen.getByText("Code font")).toBeInTheDocument();
  });

  it("calls onUpdatePreferences when the UI font changes", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<GeneralCategory prefs={DEFAULT_PREFERENCES} onUpdatePreferences={onUpdate} />);
    const trigger = screen.getByRole("combobox", { name: /UI font/ });
    await userEvent.click(trigger);
    const option = await screen.findByRole("option", { name: "SF Pro" });
    await userEvent.click(option);
    expect(onUpdate).toHaveBeenCalledWith({ appearance: { uiFont: "SF Pro" } });
  });

  it("has no axe violations", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <GeneralCategory prefs={DEFAULT_PREFERENCES} onUpdatePreferences={onUpdate} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
