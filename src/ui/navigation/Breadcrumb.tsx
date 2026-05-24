import { ChevronRight } from "lucide-react";

export type BreadcrumbItem = { label: string; href?: string; isCurrent?: boolean };

type Props = { items: BreadcrumbItem[]; className?: string };

export function Breadcrumb({ items, className = "" }: Props) {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-1 text-sm ${className}`}>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={11} aria-hidden className="text-subtext opacity-50" />}
          {item.isCurrent ? (
            <span aria-current="page" className="text-text">{item.label}</span>
          ) : item.href ? (
            <a href={item.href} className="text-subtext hover:text-text">{item.label}</a>
          ) : (
            <span className="text-subtext">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
