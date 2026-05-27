import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
    fakeTimers: {
      // Only fake Date by default so that vi.useFakeTimers() + vi.setSystemTime()
      // works for deterministic date tests without breaking async APIs like axe-core
      // that rely on real setTimeout internally.
      toFake: ["Date"],
    },
  },
});
