import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:1420",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
