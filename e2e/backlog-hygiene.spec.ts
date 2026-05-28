import { test, expect } from "@playwright/test";

test("opens backlog hygiene and inspects a duplicate suggestion", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /backlog hygiene/i }).click();
  await expect(page.getByRole("button", { name: "All" })).toBeVisible();
  await expect(page.getByText("AMP-1149 → AMP-1102")).toBeVisible();

  await page.getByRole("button", { name: /merge as duplicate.*AMP-1149/i }).click();
  await expect(page.getByRole("heading", { name: "This issue" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Duplicate of" })).toBeVisible();
});

test("view chips render and switching chips changes active state", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /backlog hygiene/i }).click();
  await expect(page.getByRole("button", { name: "All" })).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("button", { name: "By action" })).toBeVisible();
  await expect(page.getByRole("button", { name: "High confidence" })).toBeVisible();

  await page.getByRole("button", { name: "High confidence" }).click();
  await expect(page.getByRole("button", { name: "High confidence" })).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("button", { name: "All" })).not.toHaveAttribute("aria-current", "true");
});
