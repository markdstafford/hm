import type { ReactNode } from "react";

type Props = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className = "" }: Props) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-12 text-center ${className}`}>
      {icon && <div className="text-subtext">{icon}</div>}
      <div className="text-sm font-medium text-text">{title}</div>
      {description && <div className="text-sm text-subtext max-w-xs">{description}</div>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
