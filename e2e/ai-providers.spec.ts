import { test, expect } from "@playwright/test";

test("AI providers settings tab shows empty states", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /open settings/i }).click();
  await page.getByRole("button", { name: /^ai providers$/i }).click();
  await expect(page.getByRole("heading", { name: /^ai providers$/i })).toBeVisible();
  await expect(page.getByText(/Configure credentials, endpoints, model profiles, and task routing/i)).toBeVisible();
  await expect(page.getByText(/Add a credential before creating endpoints/i)).toBeVisible();
  await expect(page.getByText(/Add an endpoint that points to an approved provider or gateway/i)).toBeVisible();
  await expect(page.getByText(/Create a profile by choosing an endpoint/i)).toBeVisible();
  await expect(page.getByText(/Route AI tasks to profiles/i)).toBeVisible();
});
