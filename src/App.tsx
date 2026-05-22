import { Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";

type Theme = "latte" | "macchiato";

function useTheme(): [Theme, (t: Theme) => void] {
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const [theme, setTheme] = useState<Theme>(prefersDark ? "macchiato" : "latte");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return [theme, setTheme];
}

function App() {
  const [theme, setTheme] = useTheme();

  return (
    <main className="min-h-screen bg-background text-text flex flex-col items-center justify-center gap-6 font-sans">
      <h1 className="text-lg font-semibold tracking-tight">hello hm</h1>

      <p className="text-sm text-subtext">
        Catppuccin {theme === "latte" ? "Latte" : "Macchiato"} &middot; sapphire accent
      </p>

      <div className="flex items-center gap-3">
        <div className="h-control-base px-4 rounded bg-primary text-background text-sm flex items-center">
          Primary button
        </div>
        <div className="h-control-base px-4 rounded border border-border text-sm flex items-center">
          Secondary button
        </div>
      </div>

      <button
        aria-label={`Switch to ${theme === "latte" ? "dark" : "light"} mode`}
        onClick={() => setTheme(theme === "latte" ? "macchiato" : "latte")}
        className="flex items-center gap-2 text-sm text-subtext hover:text-text transition-colors"
      >
        {theme === "latte" ? (
          <Moon size={14} aria-hidden={true} />
        ) : (
          <Sun size={14} aria-hidden={true} />
        )}
        Toggle theme
      </button>
    </main>
  );
}

export default App;
