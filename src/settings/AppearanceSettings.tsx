import type React from "react";
import * as Select from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import type { AppPreferences, ThemeMode, ThemeId, CatppuccinAccent } from "../preferences";
import { DEFAULT_PREFERENCES, resolveTheme, resolveCatppuccinAccent, resolveThemeSlots } from "../preferences";
import {
  THEME_CATALOG,
  CATPPUCCIN_ACCENTS,
  LIGHT_THEMES,
  DARK_THEMES,
  themeSupportsFeature,
  getSystemPrefersDark,
} from "../theme";

interface AppearanceSettingsProps {
  prefs: AppPreferences;
  onUpdatePreferences: (patch: Partial<AppPreferences>) => Promise<void>;
}

function SettingRow({ label, description, children }: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-b-0">
      <div>
        <p className="text-sm text-text">{label}</p>
        {description && <p className="text-xs text-subtext mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function ThemeSelect({ value, options, onChange, label }: {
  value: ThemeId;
  options: { id: ThemeId; label: string }[];
  onChange: (val: ThemeId) => void;
  label: string;
}) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        aria-label={label}
        className="flex items-center gap-2 h-control-base px-3 rounded border border-border bg-surface text-sm text-text hover:bg-surface-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus min-w-44"
      >
        <Select.Value />
        <Select.Icon>
          <ChevronDown size={12} className="text-subtext" aria-hidden={true} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="z-50 overflow-hidden rounded border border-border bg-mantle shadow-xl"
          position="popper"
          sideOffset={4}
        >
          <Select.Viewport className="p-1">
            {options.map((opt) => (
              <Select.Item
                key={opt.id}
                value={opt.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-sm text-text cursor-pointer outline-none hover:bg-surface data-[highlighted]:bg-surface data-[state=checked]:text-primary"
              >
                <Select.ItemIndicator>
                  <Check size={12} aria-hidden={true} />
                </Select.ItemIndicator>
                <Select.ItemText>{opt.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

const THEME_MODE_OPTIONS: { value: ThemeMode; label: string; description: string }[] = [
  { value: "system", label: "System", description: "Follow OS" },
  { value: "light", label: "Light", description: "Always light" },
  { value: "dark", label: "Dark", description: "Always dark" },
];

export function AppearanceSettings({ prefs, onUpdatePreferences }: AppearanceSettingsProps) {
  const themeMode: ThemeMode = prefs.appearance?.themeMode ?? DEFAULT_PREFERENCES.appearance!.themeMode!;
  const { lightTheme, darkTheme } = resolveThemeSlots(prefs);
  const accent = resolveCatppuccinAccent(prefs);
  const prefersDark = getSystemPrefersDark();
  const resolved = resolveTheme(prefs, prefersDark);
  const resolvedThemeMeta = THEME_CATALOG.find((t) => t.id === resolved.themeId);
  const showCatppuccinAccent =
    themeSupportsFeature(lightTheme, "catppuccinAccent") ||
    themeSupportsFeature(darkTheme, "catppuccinAccent");

  const handleModeChange = (val: ThemeMode) =>
    onUpdatePreferences({ appearance: { themeMode: val } });

  const handleLightThemeChange = (val: ThemeId) =>
    onUpdatePreferences({ appearance: { lightTheme: val } });

  const handleDarkThemeChange = (val: ThemeId) =>
    onUpdatePreferences({ appearance: { darkTheme: val } });

  const handleAccentChange = (val: CatppuccinAccent) =>
    onUpdatePreferences({
      appearance: {
        themeFeatures: { catppuccin: { accent: val } },
      },
    });

  const resolverLabel =
    themeMode === "system"
      ? `System → ${resolved.brightness === "dark" ? "Dark" : "Light"} theme: ${resolvedThemeMeta?.label ?? resolved.themeId}`
      : themeMode === "light"
      ? `Light theme: ${resolvedThemeMeta?.label ?? resolved.themeId}`
      : `Dark theme: ${resolvedThemeMeta?.label ?? resolved.themeId}`;

  return (
    <div>
      <h2 className="text-md font-semibold text-text mb-4">Appearance</h2>

      {/* Theme mode */}
      <section aria-labelledby="theme-mode-heading" className="mb-6">
        <h3 id="theme-mode-heading" className="text-xs font-semibold text-subtext uppercase tracking-wider mb-2">
          Theme mode
        </h3>
        <div
          role="radiogroup"
          aria-labelledby="theme-mode-heading"
          className="flex gap-2"
        >
          {THEME_MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              role="radio"
              aria-label={opt.label}
              aria-checked={themeMode === opt.value}
              onClick={() => handleModeChange(opt.value)}
              className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded border text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                themeMode === opt.value
                  ? "border-primary text-primary bg-surface"
                  : "border-border text-subtext hover:text-text hover:bg-surface/50"
              }`}
            >
              <span className="font-medium">{opt.label}</span>
              <span className="text-xs opacity-70">{opt.description}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Theme pair */}
      <section aria-labelledby="theme-pair-heading" className="mb-6">
        <h3 id="theme-pair-heading" className="text-xs font-semibold text-subtext uppercase tracking-wider mb-2">
          Theme pair
        </h3>
        <div className="rounded-md border border-border bg-surface/30 px-3 divide-y divide-border">
          <SettingRow label="Light theme" description="Used when mode is light or system is light">
            <ThemeSelect
              value={lightTheme}
              options={LIGHT_THEMES.map((t) => ({ id: t.id, label: t.label }))}
              onChange={handleLightThemeChange}
              label="Light theme"
            />
          </SettingRow>
          <SettingRow label="Dark theme" description="Used when mode is dark or system is dark">
            <ThemeSelect
              value={darkTheme}
              options={DARK_THEMES.map((t) => ({ id: t.id, label: t.label }))}
              onChange={handleDarkThemeChange}
              label="Dark theme"
            />
          </SettingRow>
        </div>
      </section>

      {/* Catppuccin options */}
      {showCatppuccinAccent && (
        <section aria-labelledby="catppuccin-heading" className="mb-6">
          <h3 id="catppuccin-heading" className="text-xs font-semibold text-subtext uppercase tracking-wider mb-2">
            Catppuccin options
          </h3>
          <div className="rounded-md border border-border bg-surface/30 px-3">
            <SettingRow label="Accent" description="Primary and focus color for Catppuccin themes">
              <Select.Root value={accent} onValueChange={handleAccentChange}>
                <Select.Trigger
                  aria-label="Accent"
                  className="flex items-center gap-2 h-control-base px-3 rounded border border-border bg-surface text-sm text-text hover:bg-surface-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus min-w-36"
                >
                  <Select.Value />
                  <Select.Icon>
                    <ChevronDown size={12} className="text-subtext" aria-hidden={true} />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content
                    className="z-50 overflow-hidden rounded border border-border bg-mantle shadow-xl"
                    position="popper"
                    sideOffset={4}
                  >
                    <Select.Viewport className="p-1">
                      {CATPPUCCIN_ACCENTS.map((a) => (
                        <Select.Item
                          key={a}
                          value={a}
                          className="flex items-center gap-2 px-3 py-1.5 rounded text-sm text-text cursor-pointer outline-none hover:bg-surface data-[highlighted]:bg-surface data-[state=checked]:text-primary"
                        >
                          <Select.ItemIndicator>
                            <Check size={12} aria-hidden={true} />
                          </Select.ItemIndicator>
                          <Select.ItemText>
                            {a.charAt(0).toUpperCase() + a.slice(1)}
                          </Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </SettingRow>
          </div>
        </section>
      )}

      {/* Preview */}
      <section aria-labelledby="preview-heading">
        <h3 id="preview-heading" className="text-xs font-semibold text-subtext uppercase tracking-wider mb-2">
          Preview
        </h3>
        <div className="rounded-md border border-border bg-surface/30 p-4">
          <p className="text-xs text-subtext mb-3">{resolverLabel}</p>
          <div className="rounded border border-border bg-background p-3 space-y-2">
            <div className="rounded border border-border bg-surface p-2 space-y-1">
              <p className="text-sm text-text">Surface card with text</p>
              <p className="text-xs text-subtext">Subtext label</p>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="h-control-sm px-3 rounded bg-primary text-background text-xs flex items-center">
                Primary action
              </div>
              <span className="text-xs text-primary underline">Link</span>
              <div
                className="h-control-sm px-3 rounded border-2 border-focus text-xs flex items-center text-text"
                aria-label="Focus ring sample"
              >
                Focus
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
