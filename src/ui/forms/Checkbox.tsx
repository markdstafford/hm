import * as RC from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { useId } from "react";

type Props = {
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (v: boolean | "indeterminate") => void;
  disabled?: boolean;
  id?: string;
  hideLabelText?: boolean;
};

export function Checkbox({ label, id, hideLabelText = false, ...rest }: Props) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <label
      htmlFor={fieldId}
      className="inline-flex items-center gap-2 text-sm text-text"
    >
      <RC.Root
        id={fieldId}
        {...rest}
        className="h-4 w-4 rounded border border-border bg-background data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <RC.Indicator className="flex items-center justify-center text-on-primary">
          <Check size={11} aria-hidden />
        </RC.Indicator>
      </RC.Root>
      <span className={hideLabelText ? "sr-only" : undefined}>{label}</span>
    </label>
  );
}
