import { test, expect } from "@playwright/test";

// Note: e2e tests require the Vite dev server to be running (npm run dev on :1420).
// Full settings persistence testing (cross-session) requires tauri-driver and an
// isolated app data directory. These tests validate the UI flow only.
// See context-agent/wiki/testing.md for details.

test("Inbox empty state renders on app load", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/inbox is clear/i)).toBeVisible();
});

test("settings opener button is present", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /open settings/i })).toBeVisible();
});

test("settings opener flips into the page mode showing the General category", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /open settings/i }).click();
  // Breadcrumb "Settings › General" replaces the previous title-bar content.
  await expect(
    page.getByLabel(/breadcrumb/i).getByText("Settings", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "General" })).toBeVisible();
  await expect(page.getByRole("button", { name: /close settings/i })).toBeVisible();
});

test("close button returns to Inbox", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /open settings/i }).click();
  await page.getByRole("button", { name: /close settings/i }).click();
  await expect(page.getByText(/inbox is clear/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /close settings/i })).toHaveCount(0);
});

// Cross-session persistence (change → close → reopen → verify) requires a compiled Tauri
// binary and tauri-driver with an isolated app-data directory. The Vite dev-server
// environment used here does not have access to real preferencesWrite/preferencesRead IPC,
// so that path cannot be verified in this suite. See context-agent/wiki/testing.md.
test("settings theme persists across app restart — requires tauri-driver with isolated app data", async ({ page }) => {
  // eslint-disable-next-line playwright/no-skipped-test
  test.skip(true, "Requires tauri-driver with isolated app data; not available in Vite dev-server environment.");
});

// UI-side smoke: validates data-theme and data-theme-mode attributes update immediately on theme change.
// Full persistence verification (change persists after app restart) requires tauri-driver.
test("changing theme mode in Appearance settings updates data-theme immediately", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /open settings/i }).click();
  await page.getByRole("button", { name: "Appearance" }).click();
  // Theme mode is a Select combobox; click to open and pick "Dark".
  await page.getByRole("combobox", { name: /theme mode/i }).click();
  await page.getByRole("option", { name: /^dark$/i }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "catppuccin-macchiato");
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "dark");
});
