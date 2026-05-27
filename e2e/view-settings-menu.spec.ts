import { test, expect } from "@playwright/test";

test("Jira view settings menu opens, renames, navigates, and dismisses", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /jira issues/i }).click();

  // Switch to "Mine" view so we have a predictable view name
  await page.getByRole("button", { name: "Mine" }).click();
  await expect(page.getByRole("button", { name: "Mine" })).toHaveAttribute("aria-current", "true");

  // Open the view settings menu
  await page.getByRole("button", { name: /open view settings/i }).click();
  await expect(page.getByRole("heading", { name: "View settings" })).toBeVisible();
  await expect(page.getByLabel("View name")).toHaveValue("Mine");

  // Rename the view and check chip updates
  await page.getByLabel("View name").fill("Assigned to me");
  await page.getByLabel("View name").press("Enter");
  await expect(page.getByRole("button", { name: "Assigned to me" })).toHaveAttribute("aria-current", "true");

  // Reopen after rename (menu may close or stay open; ensure it can be reopened)
  const menuHeading = page.getByRole("heading", { name: "View settings" });
  if (!(await menuHeading.isVisible())) {
    await page.getByRole("button", { name: /open view settings/i }).click();
    await expect(menuHeading).toBeVisible();
  }

  // Drill into Layout — now has real controls
  await page.getByRole("button", { name: /layout/i }).click();
  await expect(page.getByRole("heading", { name: "Layout" })).toBeVisible();
  await expect(page.getByRole("button", { name: /table/i })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /regular/i })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /back to view settings/i }).click();
  await expect(page.getByRole("heading", { name: "View settings" })).toBeVisible();

  // Drill into each sub-panel and verify title + placeholder body, then back
  const panels = [
    { row: "Property visibility", body: "Coming in #41" },
    { row: "Sort", body: "Coming in #42" },
    { row: "Group", body: "Coming in #43" },
    { row: "Filter", body: "Coming in #44" },
  ];

  for (const panel of panels) {
    await page.getByRole("button", { name: new RegExp(panel.row, "i") }).click();
    await expect(page.getByRole("heading", { name: panel.row })).toBeVisible();
    await expect(page.getByText(panel.body)).toBeVisible();
    await page.getByRole("button", { name: /back to view settings/i }).click();
    await expect(page.getByRole("heading", { name: "View settings" })).toBeVisible();
  }

  // Close via the close button
  await page.getByRole("button", { name: /close view settings/i }).click();
  await expect(page.getByRole("heading", { name: "View settings" })).toHaveCount(0);

  // Reopen, drill into Sort, press Escape — menu closes entirely
  await page.getByRole("button", { name: /open view settings/i }).click();
  await page.getByRole("button", { name: "Sort" }).click();
  await expect(page.getByRole("heading", { name: "Sort" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Sort" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "View settings" })).toHaveCount(0);

  // Reopen, click outside — menu closes
  await page.getByRole("button", { name: /open view settings/i }).click();
  await expect(page.getByRole("heading", { name: "View settings" })).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(page.getByRole("heading", { name: "View settings" })).toHaveCount(0);
});

test("view settings rename persistence requires Tauri driver", async () => {
  test.skip(
    true,
    "Restart persistence requires a compiled Tauri app, tauri-driver, and isolated app data; Vite browser e2e cannot verify SQLite/preferences restart behavior.",
  );
});
