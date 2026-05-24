import { useId, type ReactNode } from "react";

type Props = {
  label: string;
  help?: string;
  error?: string;
  children: (id: string) => ReactNode;
};

export function Field({ label, help, error, children }: Props) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-subtext">
        {label}
      </label>
      {children(id)}
      {help && !error && (
        <span id={helpId} className="text-xs text-subtext-1">{help}</span>
      )}
      {error && (
        <span id={errorId} role="alert" className="text-xs text-red">{error}</span>
      )}
    </div>
  );
}
