import * as RG from "@radix-ui/react-radio-group";
import { useId, type ReactNode } from "react";

type RootProps = {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  disabled?: boolean;
  children: ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "dir">;

function Root({ children, className = "", ...rest }: RootProps) {
  return (
    <RG.Root className={`flex flex-col gap-2 ${className}`} {...rest}>
      {children}
    </RG.Root>
  );
}

type ItemProps = {
  value: string;
  label: string;
  disabled?: boolean;
};

function Item({ value, label, disabled }: ItemProps) {
  const id = useId();
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2 text-sm text-text">
      <RG.Item
        id={id}
        value={value}
        disabled={disabled}
        className="h-4 w-4 rounded-full border border-border bg-background data-[state=checked]:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <RG.Indicator className="block h-2 w-2 rounded-full bg-primary mx-auto" />
      </RG.Item>
      <span>{label}</span>
    </label>
  );
}

export const RadioGroup = Object.assign(Root, { Item });
