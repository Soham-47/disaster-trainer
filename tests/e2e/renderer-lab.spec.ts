import { test, expect } from "@playwright/test";

test.describe("Renderer Lab 3D Spike Route", () => {
  test("loads /renderer-lab without affecting main application", async ({ page }) => {
    // Navigate to /renderer-lab
    await page.goto("/renderer-lab");

    // Check loading indicator or canvas present
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Verify objective title is displayed in UI
    await expect(page.getByText("Current Objective")).toBeVisible();

    // Verify hazard exposure bar is present
    await expect(page.getByText("Hazard Exposure")).toBeVisible();

    // Verify developer drawer controls are visible
    await expect(page.getByText("Save Checkpoint")).toBeVisible();
    await expect(page.getByText("Restore Checkpoint")).toBeVisible();
  });
});
