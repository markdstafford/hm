import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

type CommonProps = {
  children: ReactNode;
  className?: string;
};

type PlainProps = CommonProps & HTMLAttributes<HTMLDivElement> & {
  interactive?: false;
};

type InteractiveProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & {
  interactive: true;
};

type Props = PlainProps | InteractiveProps;

const BASE = "rounded border border-border bg-mantle p-3";
const INTERACTIVE =
  "w-full text-left hover:bg-mantle/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus transition-colors";

export function Card(props: Props) {
  if (props.interactive) {
    const { interactive: _i, className = "", children, ...rest } = props;
    return (
      <button type="button" className={`${BASE} ${INTERACTIVE} ${className}`} {...rest}>
        {children}
      </button>
    );
  }
  const { className = "", children, ...rest } = props;
  return (
    <div className={`${BASE} ${className}`} {...rest}>
      {children}
    </div>
  );
}
