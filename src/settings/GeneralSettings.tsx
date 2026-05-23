import type React from "react";
import * as Select from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import type { AppPreferences } from "../preferences";
import { DEFAULT_PREFERENCES } from "../preferences";

interface GeneralSettingsProps {
  prefs: AppPreferences;
  onUpdatePreferences: (patch: Partial<AppPreferences>) => Promise<void>;
}

const UI_FONT_OPTIONS = ["Inter Variable", "SF Pro", "Helvetica Neue", "Arial"];
const MONO_FONT_OPTIONS = ["Fira Code", "JetBrains Mono", "Cascadia Code", "Menlo"];

function fontStyle(fontFamily: string): React.CSSProperties {
  return { fontFamily };
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

function AppSelect<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; itemStyle?: React.CSSProperties }[];
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
                <Select.ItemText>
                  <span style={opt.itemStyle}>{opt.label}</span>
                </Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export function GeneralSettings({ prefs, onUpdatePreferences }: GeneralSettingsProps) {
  const uiFont = prefs.appearance?.uiFont ?? DEFAULT_PREFERENCES.appearance!.uiFont!;
  const monoFont = prefs.appearance?.monoFont ?? DEFAULT_PREFERENCES.appearance!.monoFont!;

  const handleUiFontChange = (val: string) =>
    onUpdatePreferences({ appearance: { uiFont: val } });

  const handleMonoFontChange = (val: string) =>
    onUpdatePreferences({ appearance: { monoFont: val } });

  return (
    <div>
      <h2 className="text-md font-semibold text-text mb-4">General</h2>

      <section aria-labelledby="fonts-heading">
        <h3 id="fonts-heading" className="text-xs font-semibold text-subtext uppercase tracking-wider mb-2">
          Fonts
        </h3>
        <div className="rounded-md border border-border bg-surface/30 px-3 divide-y divide-border">
          <SettingRow label="UI font" description="Font used for interface text">
            <AppSelect
              value={uiFont}
              options={UI_FONT_OPTIONS.map((f) => ({ value: f, label: f, itemStyle: fontStyle(f) }))}
              onChange={handleUiFontChange}
              label="UI font"
            />
          </SettingRow>
          <SettingRow label="Monospace font" description="Font used in code and timestamps">
            <AppSelect
              value={monoFont}
              options={MONO_FONT_OPTIONS.map((f) => ({ value: f, label: f, itemStyle: fontStyle(f) }))}
              onChange={handleMonoFontChange}
              label="Monospace font"
            />
          </SettingRow>
        </div>
      </section>

      <section aria-labelledby="window-heading" className="mt-6">
        <h3 id="window-heading" className="text-xs font-semibold text-subtext uppercase tracking-wider mb-2">
          Window
        </h3>
        <div className="rounded-md border border-border bg-surface/30 px-3 py-3">
          <p className="text-sm text-subtext">Window size and position are saved automatically.</p>
        </div>
      </section>
    </div>
  );
}
