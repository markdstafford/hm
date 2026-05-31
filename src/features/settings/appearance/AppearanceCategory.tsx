import type { AppPreferences, ThemeMode, ThemeId, AccentId } from "../../../preferences";
import {
  DEFAULT_PREFERENCES,
  resolveAppearanceAccents,
  resolveTheme,
  resolveThemeSlots,
} from "../../../preferences";
import {
  THEME_CATALOG,
  ACCENT_OPTIONS,
  LIGHT_THEMES,
  DARK_THEMES,
} from "../../../theme";
import { Select } from "../../../ui/forms/Select";
import { SettingRow } from "../../../ui/forms/SettingRow";
import { Button } from "../../../ui/buttons/Button";
import { ConfidenceChip } from "../../../ui/data/ConfidenceChip";
import { SecondaryHighlightChip } from "../../../ui/data/SecondaryHighlightChip";
import { SentimentBadge } from "../../../ui/data/SentimentBadge";
import { LINK_KIND_META, LINK_KINDS } from "../../../ui/data/linkKindIcons";

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
  const { primaryAccent, secondaryAccent } = resolveAppearanceAccents(prefs);
  const resolved = resolveTheme(prefs, prefersDark);
  const resolvedMeta = THEME_CATALOG.find((t) => t.id === resolved.themeId);
  const accentOptions = ACCENT_OPTIONS.map((a) => ({ value: a.value, label: a.label }));

  return (
    <div className="flex flex-col gap-2 max-w-2xl">
      <header>
        <h1 className="text-lg font-semibold text-text">Appearance</h1>
        <p className="text-sm text-subtext">
          Theme mode, light/dark theme pair, and accent colors. Currently resolved:{" "}
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
      <section aria-labelledby="accent-colors-heading" className="flex flex-col gap-2">
        <div>
          <h2 id="accent-colors-heading" className="text-sm font-semibold text-text">
            Accent colors
          </h2>
          <p className="text-sm text-subtext">
            Primary controls selected states, focus, links, and primary actions. Secondary builds neutral relevance and confidence highlights.
          </p>
        </div>
        <SettingRow label="Primary accent" description="Used for focus, selected states, links, and primary actions.">
          <Select
            aria-label="Primary accent"
            value={primaryAccent}
            onValueChange={(v) =>
              onUpdatePreferences({
                appearance: {
                  accents: { primary: v as AccentId },
                  themeFeatures: { catppuccin: { accent: v as AccentId } },
                },
              })
            }
            options={accentOptions}
          />
        </SettingRow>
        <SettingRow label="Secondary accent" description="Used to build neutral relevance and confidence highlights.">
          <Select
            aria-label="Secondary accent"
            value={secondaryAccent}
            onValueChange={(v) => onUpdatePreferences({ appearance: { accents: { secondary: v as AccentId } } })}
            options={accentOptions}
          />
        </SettingRow>
      </section>
      <section aria-labelledby="appearance-preview-heading" className="rounded border border-border bg-surface p-3">
        <h2 id="appearance-preview-heading" className="mb-2 text-sm font-semibold text-text">
          Preview
        </h2>
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="#appearance-preview-heading"
              className="text-primary underline underline-offset-2"
            >
              Primary link
            </a>
            <Button variant="primary">Primary action</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SecondaryHighlightChip>83% related</SecondaryHighlightChip>
            <ConfidenceChip value={91} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SentimentBadge tone="good">Good status</SentimentBadge>
            <SentimentBadge tone="ok">Ok status</SentimentBadge>
            <SentimentBadge tone="bad">Bad status</SentimentBadge>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {LINK_KINDS.map((kind) => {
              const meta = LINK_KIND_META[kind];
              const Icon = meta.Icon;
              return (
                <span
                  key={kind}
                  className="inline-flex items-center gap-1 text-subtext"
                  title={meta.description}
                >
                  <Icon aria-hidden="true" className="size-3.5" />
                  <span>{meta.label}</span>
                </span>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
