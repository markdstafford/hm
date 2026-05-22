import { test, expect } from "@playwright/test";

test("hello hm heading is visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /hello hm/i })).toBeVisible();
});

test("theme toggle button is present", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /toggle theme/i })
  ).toBeVisible();
});
