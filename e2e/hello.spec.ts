import { test, expect } from "@playwright/test";

// Note: e2e tests require the Vite dev server to be running (npm run dev on :1420).
// Full settings persistence testing (cross-session) requires tauri-driver and an
// isolated app data directory. These tests validate the UI flow only.
// See context-agent/wiki/testing.md for details.

test("hello hm heading is visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /hello hm/i })).toBeVisible();
});

test("settings opener button is present", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /open settings/i })).toBeVisible();
});

test("settings panel opens and shows General tab", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /open settings/i }).click();
  await expect(page.getByRole("dialog", { name: /settings/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /general/i })).toBeVisible();
});

test("settings panel closes with Escape", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /open settings/i }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("settings panel closes with close button", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /open settings/i }).click();
  await page.getByRole("button", { name: /close settings/i }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

// UI-side smoke: validates data-theme attribute updates immediately on theme change.
// Full persistence verification (change persists after app restart) requires tauri-driver.
test("changing theme mode in settings updates data-theme immediately", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /open settings/i }).click();
  await page.getByRole("combobox", { name: /theme mode/i }).click();
  await page.getByRole("option", { name: /dark/i }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "macchiato");
});
