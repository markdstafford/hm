import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
  count?: number;
  badge?: boolean;
  active?: boolean;
  icon?: ReactNode;
};

export function NavItem({ label, count, badge, active, icon, className = "", ...rest }: Props) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      className={`flex w-full items-center gap-2 px-3 py-1 rounded text-sm text-left transition-colors ${
        active ? "bg-surface text-text" : "text-subtext hover:bg-surface/50 hover:text-text"
      } ${className}`}
      {...rest}
    >
      {icon && <span aria-hidden className="text-subtext">{icon}</span>}
      <span className="flex-1 truncate">{label}</span>
      {badge && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />}
      {typeof count === "number" && (
        <span className="text-xs text-subtext tabular-nums">{count}</span>
      )}
    </button>
  );
}
