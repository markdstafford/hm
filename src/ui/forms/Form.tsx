import { useId, type FormHTMLAttributes, type ReactNode } from "react";

type FormProps = Omit<FormHTMLAttributes<HTMLFormElement>, "onSubmit"> & {
  children: ReactNode;
  onSubmit: (ev: React.FormEvent<HTMLFormElement>) => void;
};

function Root({ children, className = "", onSubmit, ...rest }: FormProps) {
  function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    onSubmit(ev);
  }
  return (
    <form
      className={`flex flex-col gap-5 ${className}`}
      onSubmit={handleSubmit}
      {...rest}
    >
      {children}
    </form>
  );
}

type SectionProps = {
  label: string;
  description?: string;
  children: ReactNode;
};

function Section({ label, description, children }: SectionProps) {
  const descriptionId = useId();
  return (
    <fieldset
      className="flex flex-col gap-3 m-0 p-0 border-0"
      aria-describedby={description ? descriptionId : undefined}
    >
      <legend className="text-xs font-semibold text-subtext uppercase tracking-wider mb-0">
        {label}
      </legend>
      {description && (
        <p id={descriptionId} className="text-xs text-subtext-1 -mt-2">
          {description}
        </p>
      )}
      {children}
    </fieldset>
  );
}

function Actions({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex items-center justify-end gap-2 pt-2 border-t border-border ${className}`}
    >
      {children}
    </div>
  );
}

function ErrorMessage({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded border border-red/40 bg-red/10 p-3 text-xs text-red"
    >
      {children}
    </div>
  );
}

export const Form = Object.assign(Root, {
  Section,
  Actions,
  Error: ErrorMessage,
});
