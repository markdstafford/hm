import { useId, type ReactNode } from "react";

type Props = {
  label: string;
  help?: string;
  error?: string;
  children: (ids: { id: string; describedBy?: string }) => ReactNode;
};

export function Field({ label, help, error, children }: Props) {
  const id = useId();
  const showHelp = !!help && !error;
  const helpId = showHelp ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-subtext">
        {label}
      </label>
      {children({ id, describedBy })}
      {showHelp && (
        <span id={helpId} className="text-xs text-subtext-1">{help}</span>
      )}
      {error && (
        <span id={errorId} role="alert" className="text-xs text-red">{error}</span>
      )}
    </div>
  );
}
