import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState } from "react";
import type { AppPreferences } from "../preferences";
import { GeneralSettings } from "./GeneralSettings";
import { AppearanceSettings } from "./AppearanceSettings";

type SettingsCategory = "general" | "appearance";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  prefs: AppPreferences;
  onUpdatePreferences: (patch: Partial<AppPreferences>) => Promise<void>;
  prefersDark: boolean;
}

export function SettingsPanel({ open, onClose, prefs, onUpdatePreferences, prefersDark }: SettingsPanelProps) {
  const [category, setCategory] = useState<SettingsCategory>("general");

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Content
          aria-label="Settings"
          className="fixed inset-0 flex data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
          style={{ animationDuration: "200ms" }}
          onEscapeKeyDown={onClose}
        >
          <div className="relative flex w-full h-full bg-mantle overflow-hidden">
            {/* Sidebar */}
            <nav
              aria-label="Settings categories"
              className="flex flex-col w-44 shrink-0 bg-crust border-r border-border p-3 gap-1"
            >
              <Dialog.Title className="text-xs font-semibold text-subtext uppercase tracking-wider px-2 pb-2">
                Settings
              </Dialog.Title>
              <button
                aria-current={category === "general" ? "page" : undefined}
                onClick={() => setCategory("general")}
                className={`flex items-center px-2 py-1.5 rounded text-sm font-medium text-left transition-colors ${
                  category === "general"
                    ? "text-text bg-surface"
                    : "text-subtext hover:text-text hover:bg-surface/50"
                }`}
              >
                General
              </button>
              <button
                aria-current={category === "appearance" ? "page" : undefined}
                onClick={() => setCategory("appearance")}
                className={`flex items-center px-2 py-1.5 rounded text-sm font-medium text-left transition-colors ${
                  category === "appearance"
                    ? "text-text bg-surface"
                    : "text-subtext hover:text-text hover:bg-surface/50"
                }`}
              >
                Appearance
              </button>
            </nav>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto p-6">
              {category === "general" ? (
                <GeneralSettings prefs={prefs} onUpdatePreferences={onUpdatePreferences} />
              ) : (
                <AppearanceSettings prefs={prefs} onUpdatePreferences={onUpdatePreferences} prefersDark={prefersDark} />
              )}
            </div>

            {/* Close button */}
            <Dialog.Close asChild>
              <button
                onClick={onClose}
                aria-label="Close settings"
                className="absolute top-3 right-3 flex items-center justify-center w-6 h-6 rounded text-subtext hover:text-text hover:bg-surface transition-colors"
              >
                <X size={14} aria-hidden={true} />
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
