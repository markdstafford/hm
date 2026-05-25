import { test, expect } from "@playwright/test";

test("AI providers category shows the profile-centric empty state by default", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /open settings/i }).click();
  await page.getByRole("button", { name: /^ai providers$/i }).click();
  await expect(page.getByRole("heading", { name: /^ai providers$/i })).toBeVisible();
  await expect(
    page.getByText(/Profiles bundle a credential, endpoint, model, and routing/i),
  ).toBeVisible();
  await expect(page.getByText(/No AI profiles configured/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /add profile/i })).toBeVisible();
});

test("YAML view toggle renders the textarea editor", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /open settings/i }).click();
  await page.getByRole("button", { name: /^ai providers$/i }).click();
  await page.getByRole("button", { name: /yaml view/i }).click();
  await expect(page.getByRole("heading", { name: /yaml editor/i })).toBeVisible();
  const textarea = page.getByRole("textbox", { name: /yaml/i });
  await expect(textarea).toBeVisible();
  // Default content for an empty config is the four top-level keys.
  await expect(textarea).toContainText("credentials:");
  await expect(textarea).toContainText("endpoints:");
  await expect(textarea).toContainText("profiles:");
  await expect(textarea).toContainText("routing:");
});
