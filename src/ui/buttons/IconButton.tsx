import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Tooltip } from "../overlays/Tooltip";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
  children: ReactNode;
  dimmed?: boolean;
  active?: boolean;
};

export function IconButton({ label, children, dimmed = false, active = false, className = "", ...rest }: Props) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        data-dimmed={dimmed || undefined}
        data-active={active || undefined}
        className={`inline-flex items-center justify-center h-control-sm [width:var(--height-control-sm)] rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
          active ? "text-primary" : dimmed ? "text-subtext/60" : "text-subtext hover:text-text"
        } hover:bg-surface disabled:opacity-50 disabled:cursor-default ${className}`}
        {...rest}
      >
        {children}
      </button>
    </Tooltip>
  );
}
