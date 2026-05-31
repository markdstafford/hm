import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { AppearanceCategory } from "./AppearanceCategory";
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

describe("AppearanceCategory", () => {
  it("renders theme mode and light/dark theme rows", () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <AppearanceCategory
        prefs={DEFAULT_PREFERENCES}
        onUpdatePreferences={onUpdate}
        prefersDark={false}
      />,
    );
    expect(screen.getByText("Theme mode")).toBeInTheDocument();
    expect(screen.getByText("Light theme")).toBeInTheDocument();
    expect(screen.getByText("Dark theme")).toBeInTheDocument();
  });

  it("calls onUpdatePreferences when theme mode changes", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <AppearanceCategory
        prefs={DEFAULT_PREFERENCES}
        onUpdatePreferences={onUpdate}
        prefersDark={false}
      />,
    );
    const trigger = screen.getByRole("combobox", { name: /Theme mode/ });
    await userEvent.click(trigger);
    const option = await screen.findByRole("option", { name: /Dark/ });
    await userEvent.click(option);
    expect(onUpdate).toHaveBeenCalledWith({ appearance: { themeMode: "dark" } });
  });

  it("has no axe violations", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <AppearanceCategory
        prefs={DEFAULT_PREFERENCES}
        onUpdatePreferences={onUpdate}
        prefersDark={false}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders primary and secondary accent controls, not Catppuccin accent", () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <AppearanceCategory
        prefs={DEFAULT_PREFERENCES}
        onUpdatePreferences={onUpdate}
        prefersDark={false}
      />,
    );
    expect(screen.getByText("Accent colors")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Primary accent/ })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Secondary accent/ })).toBeInTheDocument();
    expect(screen.queryByText("Catppuccin accent")).not.toBeInTheDocument();
  });

  it("writes canonical primary accent patch with Catppuccin compat on change", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <AppearanceCategory
        prefs={DEFAULT_PREFERENCES}
        onUpdatePreferences={onUpdate}
        prefersDark={false}
      />,
    );
    await userEvent.click(screen.getByRole("combobox", { name: /Primary accent/ }));
    await userEvent.click(await screen.findByRole("option", { name: "Lavender" }));
    expect(onUpdate).toHaveBeenCalledWith({
      appearance: {
        accents: { primary: "lavender" },
        themeFeatures: { catppuccin: { accent: "lavender" } },
      },
    });
  });

  it("writes canonical secondary accent patch without primary", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <AppearanceCategory
        prefs={DEFAULT_PREFERENCES}
        onUpdatePreferences={onUpdate}
        prefersDark={false}
      />,
    );
    await userEvent.click(screen.getByRole("combobox", { name: /Secondary accent/ }));
    await userEvent.click(await screen.findByRole("option", { name: "Blue" }));
    expect(onUpdate).toHaveBeenCalledWith({ appearance: { accents: { secondary: "blue" } } });
  });

  it("renders preview with primary, secondary-highlight, sentiment, and link-kind examples", () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <AppearanceCategory
        prefs={DEFAULT_PREFERENCES}
        onUpdatePreferences={onUpdate}
        prefersDark={false}
      />,
    );
    expect(screen.getByText("Primary link")).toBeInTheDocument();
    expect(screen.getByText("Primary action")).toBeInTheDocument();
    expect(screen.getByText("83% related")).toBeInTheDocument();
    expect(screen.getByText("Good status")).toBeInTheDocument();
    expect(screen.getByText("Ok status")).toBeInTheDocument();
    expect(screen.getByText("Bad status")).toBeInTheDocument();
    expect(screen.getByText("Source link")).toBeInTheDocument();
    expect(screen.getByText("Local link")).toBeInTheDocument();
    expect(screen.getByText("Suggested link")).toBeInTheDocument();
  });
});
