import { useEffect, useState } from "react";

export type Breakpoint = "wide" | "narrow";

const QUERY = "(max-width: 899px)";

export function useViewportBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() => {
    if (typeof window === "undefined") return "wide";
    return window.matchMedia(QUERY).matches ? "narrow" : "wide";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(QUERY);
    const handler = () => setBp(mq.matches ? "narrow" : "wide");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return bp;
}
