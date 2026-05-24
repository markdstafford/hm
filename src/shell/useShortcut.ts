import { useEffect, useRef } from "react";
import { normalizeBinding, eventMatchesBinding, isFormFieldTarget } from "./keys";

export type Scope = "global" | "page";

export type UseShortcutOptions = {
  scope?: Scope;
  allowInForm?: boolean;
  sequenceTimeoutMs?: number;
  enabled?: boolean;
};

export function useShortcut(
  binding: string | string[],
  handler: (e: KeyboardEvent) => void,
  options: UseShortcutOptions = {},
): void {
  const { allowInForm = false, sequenceTimeoutMs = 1500, enabled = true } = options;
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const bindingKey = Array.isArray(binding) ? binding.join("→") : binding;

  useEffect(() => {
    if (!enabled) return;
    const isSequence = Array.isArray(binding);
    const normalized = isSequence
      ? (binding as string[]).map(normalizeBinding)
      : [normalizeBinding(binding as string)];

    let progress = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function resetSoon() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        progress = 0;
        timer = null;
      }, sequenceTimeoutMs);
    }

    function onKey(e: KeyboardEvent) {
      if (!allowInForm && isFormFieldTarget(e.target)) return;
      const expected = normalized[progress];
      if (!expected) return;
      if (!eventMatchesBinding(e, expected)) {
        if (isSequence) progress = 0;
        return;
      }
      progress += 1;
      if (progress === normalized.length) {
        progress = 0;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        handlerRef.current(e);
      } else if (isSequence) {
        resetSoon();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bindingKey, allowInForm, sequenceTimeoutMs, enabled]);
}
