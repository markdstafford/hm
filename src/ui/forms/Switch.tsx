import * as RS from "@radix-ui/react-switch";
import { useId } from "react";

type Props = {
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
  /** Visually hides the label text while keeping it accessible to screen readers. */
  hideLabelText?: boolean;
};

export function Switch({ label, id, hideLabelText, ...rest }: Props) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <label htmlFor={fieldId} className="inline-flex items-center gap-2 text-sm text-text">
      <RS.Root
        id={fieldId}
        {...rest}
        className="relative inline-flex h-4 w-7 items-center rounded-full border border-border bg-surface data-[state=checked]:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <RS.Thumb className="block h-3 w-3 translate-x-0.5 rounded-full bg-background transition-transform data-[state=checked]:translate-x-3.5" />
      </RS.Root>
      <span className={hideLabelText ? "sr-only" : undefined}>{label}</span>
    </label>
  );
}
