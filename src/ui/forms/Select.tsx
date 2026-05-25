import * as RS from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";

export type SelectOption = { value: string; label: string };

type Props = {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
};

export function Select({ options, placeholder, ...rest }: Props) {
  return (
    <RS.Root {...rest}>
      <RS.Trigger
        aria-label={rest["aria-label"]}
        className="inline-flex h-control-base items-center gap-2 rounded border border-border bg-background px-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <RS.Value placeholder={placeholder} />
        <RS.Icon><ChevronDown size={12} aria-hidden /></RS.Icon>
      </RS.Trigger>
      <RS.Portal>
        <RS.Content className="z-50 overflow-hidden rounded border border-border bg-mantle text-text shadow-lg">
          <RS.Viewport className="p-1">
            {options.map((o) => (
              <RS.Item
                key={o.value}
                value={o.value}
                className="flex items-center gap-2 rounded px-2 py-1 text-sm text-text data-[highlighted]:bg-surface focus:outline-none cursor-default"
              >
                <RS.ItemIndicator><Check size={11} aria-hidden /></RS.ItemIndicator>
                <RS.ItemText>{o.label}</RS.ItemText>
              </RS.Item>
            ))}
          </RS.Viewport>
        </RS.Content>
      </RS.Portal>
    </RS.Root>
  );
}
