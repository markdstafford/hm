import * as RS from "@radix-ui/react-separator";

type Props = {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
  className?: string;
};

export function Separator({ orientation = "horizontal", decorative = true, className = "" }: Props) {
  return (
    <RS.Root
      orientation={orientation}
      decorative={decorative}
      className={`bg-border ${orientation === "horizontal" ? "h-px w-full" : "w-px h-full"} ${className}`}
    />
  );
}
