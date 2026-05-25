import { useEffect, useState } from "react";

type Props = {
  code: string;
  language?: string;
  className?: string;
};

function detectTheme(): "catppuccin-latte" | "catppuccin-macchiato" {
  if (typeof document === "undefined") return "catppuccin-macchiato";
  const mode = document.documentElement.dataset.themeMode;
  return mode === "light" ? "catppuccin-latte" : "catppuccin-macchiato";
}

export function CodeBlock({ code, language = "text", className = "" }: Props) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function go() {
      try {
        const { codeToHtml } = await import("shiki");
        const out = await codeToHtml(code, { lang: language, theme: detectTheme() });
        if (!cancelled) setHtml(out);
      } catch {
        if (!cancelled) setHtml(null);
      }
    }
    go();
    return () => { cancelled = true; };
  }, [code, language]);

  if (html) {
    return (
      <div
        className={`text-sm rounded border border-border bg-mantle overflow-x-auto [&_pre]:p-3 [&_pre]:bg-transparent ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <pre className={`text-sm rounded border border-border bg-mantle p-3 overflow-x-auto ${className}`}>
      <code className="font-mono text-text">{code}</code>
    </pre>
  );
}
