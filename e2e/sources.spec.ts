import { test, expect } from "@playwright/test";

test("Sources settings add Jira unavailable smoke path", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /open settings/i }).click();
  await page.getByRole("button", { name: /^sources$/i }).click();
  await expect(page.getByRole("heading", { name: /^sources$/i })).toBeVisible();
  await page.getByRole("button", { name: /add source/i }).click();
  await page.getByRole("button", { name: /jira data center/i }).click();
  await page.getByLabel(/server url/i).fill("http://localhost:2990/jira");
  await page.getByLabel(/personal access token/i).fill("test-pat-not-secret");
  await page.getByRole("button", { name: /test connection/i }).click();
  await expect(page.getByText(/issue #9/i)).toBeVisible();
});
