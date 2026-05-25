import type { AppPreferences } from "../../preferences";
import { Breadcrumb } from "../../ui/navigation/Breadcrumb";
import { GeneralCategory } from "./general/GeneralCategory";
import { AppearanceCategory } from "./appearance/AppearanceCategory";
import { SourcesCategory } from "./sources/SourcesCategory";
import { AiProvidersCategory } from "./ai-providers/AiProvidersCategory";
import { getCategoryLabel, type SettingsCategory } from "./categories";

interface SettingsPageProps {
  category: SettingsCategory;
  onPickCategory: (next: SettingsCategory) => void;
  prefs: AppPreferences;
  onUpdatePreferences: (patch: Partial<AppPreferences>) => Promise<void>;
  prefersDark: boolean;
}

export function SettingsBreadcrumb({ category }: { category: SettingsCategory }) {
  return (
    <Breadcrumb
      items={[
        { label: "Settings" },
        { label: getCategoryLabel(category), isCurrent: true },
      ]}
    />
  );
}

export function SettingsPage({
  category,
  prefs,
  onUpdatePreferences,
  prefersDark,
}: SettingsPageProps) {
  return (
    <div className="p-6">
      {category === "general" && (
        <GeneralCategory prefs={prefs} onUpdatePreferences={onUpdatePreferences} />
      )}
      {category === "appearance" && (
        <AppearanceCategory prefs={prefs} onUpdatePreferences={onUpdatePreferences} prefersDark={prefersDark} />
      )}
      {category === "sources" && <SourcesCategory />}
      {category === "ai-providers" && <AiProvidersCategory />}
    </div>
  );
}
