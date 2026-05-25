import { ExternalLink } from "lucide-react";
import type { AnchorHTMLAttributes, ReactNode } from "react";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
  showExternalIcon?: boolean;
};

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

export function Link({ href, children, className = "", showExternalIcon = true, ...rest }: Props) {
  const external = isExternal(href);
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer noopener" : undefined}
      className={`text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded ${className}`}
      {...rest}
    >
      {children}
      {external && showExternalIcon && (
        <ExternalLink size={11} aria-hidden className="inline-block ml-1 align-[-1px]" />
      )}
    </a>
  );
}
