import { Sliders, Palette, Database, Sparkles, type LucideIcon } from "lucide-react";

export type SettingsCategory = "general" | "appearance" | "sources" | "ai-providers";

export type SettingsCategoryMeta = {
  id: SettingsCategory;
  label: string;
  icon: LucideIcon;
};

export const SETTINGS_CATEGORIES: ReadonlyArray<SettingsCategoryMeta> = [
  { id: "general", label: "General", icon: Sliders },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "sources", label: "Sources", icon: Database },
  { id: "ai-providers", label: "AI providers", icon: Sparkles },
];

export function getCategoryLabel(id: SettingsCategory): string {
  return SETTINGS_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
