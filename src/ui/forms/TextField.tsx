import { forwardRef, type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const TextField = forwardRef<HTMLInputElement, Props>(function TextField(
  { invalid = false, className = "", type = "text", ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      data-invalid={invalid || undefined}
      className={`h-control-base w-full rounded border px-2 text-sm bg-background text-text placeholder:text-subtext-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
        invalid ? "border-red" : "border-border"
      } ${className}`}
      {...rest}
    />
  );
});
