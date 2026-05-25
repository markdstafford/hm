import type { AppPreferences, ThemeMode, ThemeId, CatppuccinAccent } from "../../../preferences";
import {
  DEFAULT_PREFERENCES,
  resolveTheme,
  resolveCatppuccinAccent,
  resolveThemeSlots,
} from "../../../preferences";
import {
  THEME_CATALOG,
  CATPPUCCIN_ACCENTS,
  LIGHT_THEMES,
  DARK_THEMES,
  themeSupportsFeature,
} from "../../../theme";
import { Select } from "../../../ui/forms/Select";
import { SettingRow } from "../../../ui/forms/SettingRow";

interface AppearanceCategoryProps {
  prefs: AppPreferences;
  onUpdatePreferences: (patch: Partial<AppPreferences>) => Promise<void>;
  prefersDark: boolean;
}

const THEME_MODE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "System (follow OS)" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function AppearanceCategory({
  prefs,
  onUpdatePreferences,
  prefersDark,
}: AppearanceCategoryProps) {
  const themeMode: ThemeMode = prefs.appearance?.themeMode ?? DEFAULT_PREFERENCES.appearance!.themeMode!;
  const { lightTheme, darkTheme } = resolveThemeSlots(prefs);
  const accent = resolveCatppuccinAccent(prefs);
  const resolved = resolveTheme(prefs, prefersDark);
  const showCatppuccinAccent =
    themeSupportsFeature(lightTheme, "catppuccinAccent") ||
    themeSupportsFeature(darkTheme, "catppuccinAccent");
  const resolvedMeta = THEME_CATALOG.find((t) => t.id === resolved.themeId);

  return (
    <div className="flex flex-col gap-2 max-w-2xl">
      <header>
        <h1 className="text-lg font-semibold text-text">Appearance</h1>
        <p className="text-sm text-subtext">
          Theme mode, light/dark theme pair, and accent. Currently resolved:{" "}
          <span className="font-mono">{resolvedMeta?.label ?? resolved.themeId}</span>.
        </p>
      </header>
      <SettingRow label="Theme mode" description="Match the operating system, or pin to one theme.">
        <Select
          aria-label="Theme mode"
          value={themeMode}
          onValueChange={(v) => onUpdatePreferences({ appearance: { themeMode: v as ThemeMode } })}
          options={THEME_MODE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
      </SettingRow>
      <SettingRow label="Light theme" description="Used when the resolved mode is light.">
        <Select
          aria-label="Light theme"
          value={lightTheme}
          onValueChange={(v) => onUpdatePreferences({ appearance: { lightTheme: v as ThemeId } })}
          options={LIGHT_THEMES.map((t) => ({ value: t.id, label: t.label }))}
        />
      </SettingRow>
      <SettingRow label="Dark theme" description="Used when the resolved mode is dark.">
        <Select
          aria-label="Dark theme"
          value={darkTheme}
          onValueChange={(v) => onUpdatePreferences({ appearance: { darkTheme: v as ThemeId } })}
          options={DARK_THEMES.map((t) => ({ value: t.id, label: t.label }))}
        />
      </SettingRow>
      {showCatppuccinAccent && (
        <SettingRow label="Catppuccin accent" description="Primary accent color for Catppuccin themes.">
          <Select
            aria-label="Catppuccin accent"
            value={accent}
            onValueChange={(v) =>
              onUpdatePreferences({
                appearance: { themeFeatures: { catppuccin: { accent: v as CatppuccinAccent } } },
              })
            }
            options={CATPPUCCIN_ACCENTS.map((a) => ({ value: a, label: a }))}
          />
        </SettingRow>
      )}
    </div>
  );
}
