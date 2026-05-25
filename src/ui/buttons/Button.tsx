import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "base" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:opacity-90",
  secondary: "bg-surface text-text border border-border hover:bg-surface-1",
  ghost: "bg-transparent text-text hover:bg-surface",
  destructive: "bg-red text-on-destructive hover:opacity-90",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-control-sm px-2 text-xs",
  base: "h-control-base px-3 text-sm",
  lg: "h-control-lg px-4 text-base",
};

export function Button({ variant = "secondary", size = "base", className = "", children, ...rest }: Props) {
  return (
    <button
      type="button"
      data-variant={variant}
      data-size={size}
      className={`inline-flex items-center justify-center rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
