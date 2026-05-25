import type { ReactNode } from "react";

type Props = {
  label: string;
  description?: string;
  children: ReactNode;
};

export function SettingRow({ label, description, children }: Props) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm text-text">{label}</p>
        {description && <p className="text-xs text-subtext mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
