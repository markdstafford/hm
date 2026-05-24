export type SettingsCategory = "general" | "appearance" | "sources" | "ai-providers";

export interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}
