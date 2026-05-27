import { test, expect } from "@playwright/test";

test("Jira layout sub-panel shows real controls", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /jira issues/i }).click();
  await page.getByRole("button", { name: /open view settings/i }).click();
  await page.getByRole("button", { name: /layout/i }).click();

  await expect(page.getByRole("heading", { name: "Layout" })).toBeVisible();

  // Table is selected and enabled
  await expect(page.getByRole("button", { name: /table/i })).toHaveAttribute("aria-pressed", "true");

  // Future layout types are disabled
  for (const label of ["Board", "List", "Gallery", "Timeline", "Calendar"]) {
    const btn = page.getByText(label).first();
    const closest = btn.locator(".."); // parent element
    // The disabled button may be the parent or the element itself
    // Just check the tile exists and is labeled as disabled
    await expect(page.locator(`button[aria-disabled="true"]`, { hasText: label })).toBeVisible();
  }

  // Density toggle shows Regular as default
  await expect(page.getByRole("button", { name: /regular/i })).toHaveAttribute("aria-pressed", "true");

  // Switch to Compact
  await page.getByRole("button", { name: /compact/i }).click();
  await expect(page.getByRole("button", { name: /compact/i })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /regular/i })).toHaveAttribute("aria-pressed", "false");

  // Preview row is visible
  await expect(page.getByRole("button", { name: /preview/i })).toBeVisible();

  // Open preview popover and switch to Bottom
  await page.getByRole("button", { name: /preview/i }).click();
  await expect(page.getByRole("listbox", { name: "Preview options" })).toBeVisible();
  await expect(page.getByRole("option", { name: /side/i })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("option", { name: /bottom/i }).click();
  // Popover should close after selection
  await expect(page.getByRole("listbox", { name: "Preview options" })).toHaveCount(0);
});

test("Jira full-page preview returns to list when fixture rows exist", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /jira issues/i }).click();

  // Check if any issue rows exist (requires seeded data)
  const firstIssue = page.getByRole("button", { name: /open .+:/i }).first();
  const hasRows = await firstIssue.count().then((n) => n > 0).catch(() => false);

  if (!hasRows) {
    test.skip(
      true,
      "Browser e2e has no deterministic Jira issue fixture rows. Unit/page tests cover full-page preview and keyboard navigation.",
    );
    return;
  }

  // Switch to full-page preview
  await page.getByRole("button", { name: /open view settings/i }).click();
  await page.getByRole("button", { name: /layout/i }).click();
  await page.getByRole("button", { name: /preview/i }).click();
  await page.getByRole("option", { name: /full page/i }).click();
  await page.getByRole("button", { name: /close view settings/i }).click();

  // Click the first issue row
  await firstIssue.click();
  await expect(page.getByRole("button", { name: "Back to list (Esc)" })).toBeVisible();

  // Press Escape to return
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Back to list (Esc)" })).toHaveCount(0);
});
