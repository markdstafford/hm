import { test, expect } from "@playwright/test";

test("Jira viewer named views render and basic chip actions work", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /jira issues/i }).click();

  await expect(page.getByRole("button", { name: "All open" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mine" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Recently updated" })).toBeVisible();

  await page.getByRole("button", { name: "Mine" }).click();
  await expect(page.getByRole("button", { name: "Mine" })).toHaveAttribute("aria-current", "true");

  await page.getByRole("button", { name: /create named view/i }).click();
  await expect(page.getByRole("button", { name: "Untitled view" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Untitled view" })).toHaveAttribute("aria-current", "true");

  await page.getByRole("button", { name: "Untitled view" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: /delete view/i }).click();
  await expect(page.getByRole("button", { name: "Untitled view" })).toHaveCount(0);
});

test("named view restart persistence requires Tauri driver", async () => {
  test.skip(true, "Restart persistence requires a compiled Tauri app, tauri-driver, and isolated app data; Vite browser e2e cannot verify SQLite/preferences restart behavior.");
});
