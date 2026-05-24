import type { ReactNode } from "react";
import { SectionLabel } from "./SectionLabel";
import { SectionDivider } from "./SectionDivider";

type Props = { label: string; children: ReactNode; withDivider?: boolean };

export function NavSection({ label, children, withDivider = false }: Props) {
  return (
    <section className="flex flex-col">
      <SectionLabel>{label}</SectionLabel>
      <div className="flex flex-col gap-0.5 py-0.5">{children}</div>
      {withDivider && <SectionDivider />}
    </section>
  );
}
