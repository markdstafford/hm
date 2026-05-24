import { Popover } from "../overlays/Popover";
import { Checkbox } from "./Checkbox";

export type MultiSelectOption = { value: string; label: string };

type Props = {
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  "aria-label"?: string;
  placeholder?: string;
};

export function MultiSelect({ options, value, onChange, placeholder = "Select…", ...rest }: Props) {
  const summary = value.length
    ? options.filter((o) => value.includes(o.value)).map((o) => o.label).join(", ")
    : placeholder;
  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }
  return (
    <Popover
      trigger={
        <button
          type="button"
          aria-label={rest["aria-label"]}
          className="inline-flex h-control-base items-center rounded border border-border bg-background px-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <span className="truncate max-w-[10rem]">{rest["aria-label"]}: {summary}</span>
        </button>
      }
    >
      <div className="flex flex-col gap-1 p-2 min-w-[12rem]">
        {options.map((o) => (
          <Checkbox
            key={o.value}
            label={o.label}
            checked={value.includes(o.value)}
            onCheckedChange={() => toggle(o.value)}
          />
        ))}
      </div>
    </Popover>
  );
}
