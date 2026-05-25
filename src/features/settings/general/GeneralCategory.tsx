import { type AppPreferences, DEFAULT_PREFERENCES } from "../../../preferences";
import { Select } from "../../../ui/forms/Select";
import { SettingRow } from "../../../ui/forms/SettingRow";

interface GeneralCategoryProps {
  prefs: AppPreferences;
  onUpdatePreferences: (patch: Partial<AppPreferences>) => Promise<void>;
}

const UI_FONT_OPTIONS = ["Inter Variable", "SF Pro", "Helvetica Neue", "Arial"];
const MONO_FONT_OPTIONS = ["Fira Code", "JetBrains Mono", "Cascadia Code", "Menlo"];

export function GeneralCategory({ prefs, onUpdatePreferences }: GeneralCategoryProps) {
  const uiFont = prefs.appearance?.uiFont ?? DEFAULT_PREFERENCES.appearance!.uiFont!;
  const monoFont = prefs.appearance?.monoFont ?? DEFAULT_PREFERENCES.appearance!.monoFont!;

  return (
    <div className="flex flex-col gap-2 max-w-2xl">
      <header>
        <h1 className="text-lg font-semibold text-text">General</h1>
        <p className="text-sm text-subtext">
          Application-wide preferences. Stored in the OS user-config file.
        </p>
      </header>
      <SettingRow label="UI font" description="Used for all interface text.">
        <Select
          aria-label="UI font"
          value={uiFont}
          onValueChange={(v) => onUpdatePreferences({ appearance: { uiFont: v } })}
          options={UI_FONT_OPTIONS.map((f) => ({ value: f, label: f }))}
        />
      </SettingRow>
      <SettingRow label="Code font" description="Used for file paths, identifiers, and code.">
        <Select
          aria-label="Code font"
          value={monoFont}
          onValueChange={(v) => onUpdatePreferences({ appearance: { monoFont: v } })}
          options={MONO_FONT_OPTIONS.map((f) => ({ value: f, label: f }))}
        />
      </SettingRow>
    </div>
  );
}
