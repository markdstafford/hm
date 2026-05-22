import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { vi, beforeAll } from "vitest";
import { SettingsPanel } from "./SettingsPanel";
import type { AppPreferences } from "../preferences";

// Radix Select uses PointerEvent and scrollIntoView internally; jsdom doesn't implement them.
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).PointerEvent = window.MouseEvent;
  // Radix also checks hasPointerCapture / releasePointerCapture on elements
  if (!window.HTMLElement.prototype.hasPointerCapture) {
    window.HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!window.HTMLElement.prototype.releasePointerCapture) {
    window.HTMLElement.prototype.releasePointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.setPointerCapture) {
    window.HTMLElement.prototype.setPointerCapture = () => {};
  }
  // jsdom doesn't implement scrollIntoView
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }
});

const defaultPrefs: AppPreferences = {
  appearance: {
    themeMode: "system",
    uiFont: "Inter Variable",
    monoFont: "Fira Code",
  },
};

function renderPanel(props?: Partial<Parameters<typeof SettingsPanel>[0]>) {
  const onClose = vi.fn();
  const onUpdatePreferences = vi.fn().mockResolvedValue(undefined);
  const result = render(
    <SettingsPanel
      open={true}
      onClose={onClose}
      prefs={defaultPrefs}
      onUpdatePreferences={onUpdatePreferences}
      {...props}
    />
  );
  return { ...result, onClose, onUpdatePreferences };
}

describe("SettingsPanel", () => {
  it("renders the settings dialog when open", () => {
    renderPanel();
    expect(screen.getByRole("dialog", { name: /settings/i })).toBeInTheDocument();
  });

  it("does not render the dialog when closed", () => {
    renderPanel({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows General as the active category", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: /general/i })).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const { onClose } = renderPanel();
    await user.click(screen.getByRole("button", { name: /close settings/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when Escape is pressed", async () => {
    const user = userEvent.setup();
    const { onClose } = renderPanel();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("renders theme mode control", () => {
    renderPanel();
    expect(screen.getByRole("combobox", { name: /theme mode/i })).toBeInTheDocument();
  });

  it("renders UI font control", () => {
    renderPanel();
    expect(screen.getByRole("combobox", { name: /ui font/i })).toBeInTheDocument();
  });

  it("renders monospace font control", () => {
    renderPanel();
    expect(screen.getByRole("combobox", { name: /monospace font/i })).toBeInTheDocument();
  });

  it("calls onUpdatePreferences with theme patch when theme changes", async () => {
    const user = userEvent.setup();
    const { onUpdatePreferences } = renderPanel();
    await user.click(screen.getByRole("combobox", { name: /theme mode/i }));
    await user.click(await screen.findByRole("option", { name: /light/i }));
    expect(onUpdatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({ appearance: expect.objectContaining({ themeMode: "light" }) })
    );
  });

  it("renders UI font options with their own fontFamily style when dropdown is open", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("combobox", { name: /ui font/i }));
    const interOption = await screen.findByRole("option", { name: /inter variable/i });
    const styledSpan = interOption.querySelector<HTMLElement>("span[style]");
    expect(styledSpan?.style.fontFamily).toContain("Inter Variable");
  });

  it("renders monospace font options with their own fontFamily style when dropdown is open", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("combobox", { name: /monospace font/i }));
    const firaOption = await screen.findByRole("option", { name: /fira code/i });
    const styledSpan = firaOption.querySelector<HTMLElement>("span[style]");
    expect(styledSpan?.style.fontFamily).toContain("Fira Code");
  });

  it("has no accessibility violations when open", async () => {
    const { container } = renderPanel();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
