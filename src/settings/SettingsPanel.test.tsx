import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { vi, beforeAll } from "vitest";
import { SettingsPanel } from "./SettingsPanel";
import type { AppPreferences } from "../preferences";

vi.mock("../bindings", () => ({
  commands: {
    sourceConfigGet: vi.fn().mockResolvedValue({ status: "ok", data: { version: 1, sources: [] } }),
    sourceConfigSave: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    sourceCredentialSecretSet: vi.fn().mockResolvedValue({ status: "ok", data: "source.jira.test.pat" }),
    sourceCredentialDelete: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    sourceConfigRemove: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    jiraSourceTestConnection: vi.fn().mockResolvedValue({
      status: "ok",
      data: {
        status: "Unavailable",
        tested_at: "2024-01-01T00:00:00Z",
        message: "Live connection testing depends on issue #9. The source can be saved, but projects must wait for the Jira API client.",
        suggested_fix: null,
        projects: [],
        category: "Unavailable",
      },
    }),
  },
}));

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

const defaultPrefs: AppPreferences = {
  appearance: {
    themeMode: "system",
    lightTheme: "catppuccin-latte",
    darkTheme: "catppuccin-macchiato",
    themeFeatures: { catppuccin: { accent: "sapphire" } },
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
      prefersDark={false}
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

  it("shows General as the active category by default", () => {
    renderPanel();
    const generalBtn = screen.getByRole("button", { name: /general/i });
    expect(generalBtn).toHaveAttribute("aria-current", "page");
  });

  it("renders Appearance category button in sidebar", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: /^appearance$/i })).toBeInTheDocument();
  });

  it("switches to Appearance when Appearance button is clicked", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: /^appearance$/i }));
    expect(screen.getByRole("heading", { name: /^appearance$/i })).toBeInTheDocument();
  });

  it("Appearance button becomes active after click", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: /^appearance$/i }));
    expect(screen.getByRole("button", { name: /^appearance$/i })).toHaveAttribute("aria-current", "page");
  });

  it("General button loses active state after switching to Appearance", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: /^appearance$/i }));
    expect(screen.getByRole("button", { name: /general/i })).not.toHaveAttribute("aria-current", "page");
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

  it("renders UI font control in General", () => {
    renderPanel();
    expect(screen.getByRole("combobox", { name: /ui font/i })).toBeInTheDocument();
  });

  it("renders monospace font control in General", () => {
    renderPanel();
    expect(screen.getByRole("combobox", { name: /monospace font/i })).toBeInTheDocument();
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

  // Appearance tab tests
  describe("Appearance tab", () => {
    async function openAppearance(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole("button", { name: /^appearance$/i }));
    }

    it("renders theme mode radio group in Appearance", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openAppearance(user);
      expect(screen.getByRole("radiogroup", { name: /theme mode/i })).toBeInTheDocument();
    });

    it("renders System, Light, Dark mode options", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openAppearance(user);
      expect(screen.getByRole("radio", { name: /system/i })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /light/i })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /dark/i })).toBeInTheDocument();
    });

    it("System mode is checked by default", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openAppearance(user);
      expect(screen.getByRole("radio", { name: /system/i })).toHaveAttribute("aria-checked", "true");
    });

    it("calls onUpdatePreferences with themeMode patch when mode changes", async () => {
      const user = userEvent.setup();
      const { onUpdatePreferences } = renderPanel();
      await openAppearance(user);
      await user.click(screen.getByRole("radio", { name: /^light$/i }));
      expect(onUpdatePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ appearance: expect.objectContaining({ themeMode: "light" }) })
      );
    });

    it("renders Light theme control", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openAppearance(user);
      expect(screen.getByRole("combobox", { name: /light theme/i })).toBeInTheDocument();
    });

    it("renders Dark theme control", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openAppearance(user);
      expect(screen.getByRole("combobox", { name: /dark theme/i })).toBeInTheDocument();
    });

    it("calls onUpdatePreferences with lightTheme patch when light theme changes", async () => {
      const user = userEvent.setup();
      const { onUpdatePreferences } = renderPanel();
      await openAppearance(user);
      await user.click(screen.getByRole("combobox", { name: /light theme/i }));
      const githubLightOption = await screen.findByRole("option", { name: /github light/i });
      await user.click(githubLightOption);
      expect(onUpdatePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ appearance: expect.objectContaining({ lightTheme: "github-light" }) })
      );
    });

    it("calls onUpdatePreferences with darkTheme patch when dark theme changes", async () => {
      const user = userEvent.setup();
      const { onUpdatePreferences } = renderPanel();
      await openAppearance(user);
      await user.click(screen.getByRole("combobox", { name: /dark theme/i }));
      const draculaOption = await screen.findByRole("option", { name: /dracula/i });
      await user.click(draculaOption);
      expect(onUpdatePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ appearance: expect.objectContaining({ darkTheme: "dracula" }) })
      );
    });

    it("renders Catppuccin accent control when a Catppuccin theme is selected", async () => {
      const user = userEvent.setup();
      renderPanel(); // defaultPrefs uses catppuccin-latte / catppuccin-macchiato
      await openAppearance(user);
      expect(screen.getByRole("combobox", { name: /accent/i })).toBeInTheDocument();
    });

    it("calls onUpdatePreferences with accent patch when accent changes", async () => {
      const user = userEvent.setup();
      const { onUpdatePreferences } = renderPanel();
      await openAppearance(user);
      await user.click(screen.getByRole("combobox", { name: /accent/i }));
      const greenOption = await screen.findByRole("option", { name: /^green$/i });
      await user.click(greenOption);
      expect(onUpdatePreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          appearance: expect.objectContaining({
            themeFeatures: expect.objectContaining({
              catppuccin: expect.objectContaining({ accent: "green" }),
            }),
          }),
        })
      );
    });

    it("hides Catppuccin accent when non-Catppuccin themes are selected", async () => {
      const user = userEvent.setup();
      renderPanel({
        prefs: {
          ...defaultPrefs,
          appearance: {
            ...defaultPrefs.appearance,
            lightTheme: "github-light",
            darkTheme: "github-dark",
          },
        },
      });
      await openAppearance(user);
      expect(screen.queryByRole("combobox", { name: /accent/i })).not.toBeInTheDocument();
    });

    it("renders preview section with resolver label", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openAppearance(user);
      expect(screen.getByText(/system →/i)).toBeInTheDocument();
    });

    it("has no accessibility violations on Appearance tab", async () => {
      const user = userEvent.setup();
      const { container } = renderPanel();
      await openAppearance(user);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  it("has no accessibility violations on General tab", async () => {
    const { container } = renderPanel();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("renders Sources category between Appearance and AI providers", () => {
    renderPanel();
    const buttons = screen.getAllByRole("button").map(button => button.textContent?.trim()).filter(Boolean);
    expect(buttons).toEqual(expect.arrayContaining(["General", "Appearance", "Sources", "AI providers"]));
    expect(buttons.indexOf("Sources")).toBeGreaterThan(buttons.indexOf("Appearance"));
    expect(buttons.indexOf("Sources")).toBeLessThan(buttons.indexOf("AI providers"));
  });

  it("clicking Sources shows accessible heading and storage split description", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: /^sources$/i }));
    expect(screen.getByRole("heading", { name: /^sources$/i })).toBeInTheDocument();
    expect(screen.getByText(/Secrets are stored in the OS keychain/i)).toBeInTheDocument();
  });
});
