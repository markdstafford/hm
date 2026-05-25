import { type ButtonHTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Tooltip } from "../overlays/Tooltip";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
  children: ReactNode;
  dimmed?: boolean;
  active?: boolean;
};

// Use aria-disabled rather than the native `disabled` attribute so the button
// stays focusable and continues to dispatch pointer events. That is what lets
// the wrapping Radix Tooltip attach to "(coming soon)" buttons — disabled
// native buttons are not reliable Tooltip triggers.
export function IconButton({
  label,
  children,
  dimmed = false,
  active = false,
  disabled = false,
  className = "",
  onClick,
  onKeyDown,
  ...rest
}: Props) {
  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    if (disabled) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  }
  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      return;
    }
    onKeyDown?.(e);
  }
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        aria-disabled={disabled || undefined}
        data-dimmed={dimmed || undefined}
        data-active={active || undefined}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={`inline-flex items-center justify-center h-control-sm [width:var(--height-control-sm)] rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus aria-disabled:opacity-50 aria-disabled:cursor-default ${
          active ? "text-primary" : dimmed ? "text-subtext/60" : "text-subtext hover:text-text"
        } hover:bg-surface ${className}`}
        {...rest}
      >
        {children}
      </button>
    </Tooltip>
  );
}
