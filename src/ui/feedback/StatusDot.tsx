type Tone = "green" | "red" | "yellow" | "primary" | "subtext";

const TONE: Record<Tone, string> = {
  green: "bg-green",
  red: "bg-red",
  yellow: "bg-yellow",
  primary: "bg-primary",
  subtext: "bg-subtext",
};

type Props = {
  tone: Tone;
  label?: string;
  className?: string;
};

export function StatusDot({ tone, label, className = "" }: Props) {
  return (
    <span role={label ? "status" : undefined} aria-label={label} className={`inline-flex items-center gap-1 ${className}`}>
      <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${TONE[tone]}`} />
      {label && <span className="text-xs text-subtext">{label}</span>}
    </span>
  );
}
