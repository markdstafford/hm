import type { ReactNode } from "react";

type Props = {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  sidebarVisible: boolean;
};

export function Footer({ left, center, right, sidebarVisible }: Props) {
  return (
    <footer
      className="flex items-center border-t border-border bg-mantle text-xs"
      style={{ height: "var(--height-footer)" }}
    >
      <div
        className="flex items-center px-2 gap-1 border-r border-border/30"
        style={{ width: sidebarVisible ? "var(--width-sidebar)" : "auto", minWidth: "2.5rem" }}
      >
        {left}
      </div>
      <div className="flex-1 flex items-center justify-center px-3 text-subtext">
        {center}
      </div>
      <div className="flex items-center px-2 gap-1 border-l border-border/30">
        {right}
      </div>
    </footer>
  );
}
