export type SettingsCategory = "general" | "appearance" | "ai-providers";

export interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}
