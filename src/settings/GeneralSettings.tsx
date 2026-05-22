import * as Select from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import type { AppPreferences, ThemeMode } from "../preferences";
import { DEFAULT_PREFERENCES } from "../preferences";

interface GeneralSettingsProps {
  prefs: AppPreferences;
  onUpdatePreferences: (patch: Partial<AppPreferences>) => Promise<void>;
}

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const UI_FONT_OPTIONS = ["Inter Variable", "SF Pro", "Helvetica Neue", "Arial"];
const MONO_FONT_OPTIONS = ["Fira Code", "JetBrains Mono", "Cascadia Code", "Menlo"];

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

function AppSelect<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (val: T) => void;
  label: string;
}) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        aria-label={label}
        className="flex items-center gap-2 h-control-base px-3 rounded border border-border bg-surface text-sm text-text hover:bg-surface-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
                key={opt.value}
                value={opt.value}
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

export function GeneralSettings({ prefs, onUpdatePreferences }: GeneralSettingsProps) {
  const themeMode = prefs.appearance?.themeMode ?? DEFAULT_PREFERENCES.appearance!.themeMode!;
  const uiFont = prefs.appearance?.uiFont ?? DEFAULT_PREFERENCES.appearance!.uiFont!;
  const monoFont = prefs.appearance?.monoFont ?? DEFAULT_PREFERENCES.appearance!.monoFont!;

  const handleThemeChange = (val: ThemeMode) =>
    onUpdatePreferences({ appearance: { themeMode: val } });

  const handleUiFontChange = (val: string) =>
    onUpdatePreferences({ appearance: { uiFont: val } });

  const handleMonoFontChange = (val: string) =>
    onUpdatePreferences({ appearance: { monoFont: val } });

  return (
    <div>
      <h2 className="text-md font-semibold text-text mb-0.5">General</h2>
      <p className="text-xs text-subtext mb-4">Local app preferences stored on this Mac</p>

      <section aria-labelledby="appearance-heading" className="mb-6">
        <h3 id="appearance-heading" className="text-xs font-semibold text-subtext uppercase tracking-wider mb-2">
          Appearance
        </h3>
        <div className="rounded-md border border-border bg-surface/30 px-3 divide-y divide-border">
          <SettingRow label="Theme mode" description="Controls light or dark appearance">
            <AppSelect
              value={themeMode}
              options={THEME_OPTIONS}
              onChange={handleThemeChange}
              label="Theme mode"
            />
          </SettingRow>
          <SettingRow label="UI font" description="Font used for interface text">
            <AppSelect
              value={uiFont}
              options={UI_FONT_OPTIONS.map((f) => ({ value: f, label: f }))}
              onChange={handleUiFontChange}
              label="UI font"
            />
          </SettingRow>
          <SettingRow label="Monospace font" description="Font used in code and timestamps">
            <AppSelect
              value={monoFont}
              options={MONO_FONT_OPTIONS.map((f) => ({ value: f, label: f }))}
              onChange={handleMonoFontChange}
              label="Monospace font"
            />
          </SettingRow>
        </div>
      </section>

      <section aria-labelledby="window-heading">
        <h3 id="window-heading" className="text-xs font-semibold text-subtext uppercase tracking-wider mb-2">
          Window
        </h3>
        <div className="rounded-md border border-border bg-surface/30 px-3 py-3">
          <p className="text-sm text-subtext">
            Window size and position are saved automatically.
          </p>
        </div>
      </section>
    </div>
  );
}
