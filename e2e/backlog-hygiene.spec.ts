import { test, expect } from "@playwright/test";

test("opens backlog hygiene, inspects a duplicate suggestion, and switches to By action view", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /backlog hygiene/i }).click();
  await expect(page.getByRole("button", { name: "All" })).toBeVisible();
  await expect(page.getByText("AMP-1149 → AMP-1102")).toBeVisible();

  await page.getByRole("button", { name: /merge as duplicate.*AMP-1149/i }).click();
  await expect(page.getByRole("heading", { name: "This issue" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Duplicate of" })).toBeVisible();

  await page.getByRole("button", { name: "By action" }).click();
  await expect(page.getByRole("button", { name: "By action" })).toHaveAttribute("aria-current", "true");
  await expect(page.getByText("Merge as duplicate")).toBeVisible();
  await expect(page.getByText("Close as resolved")).toBeVisible();
  await expect(page.getByText("Ping for context")).toBeVisible();
});
