import { expect, test } from "@playwright/test";

test.describe("Happy Oyster apartment-fire trainer", () => {
  test("presents one focused immersive scenario without raw model prompts", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "One apartment. Two futures." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Begin live scenario" })).toBeVisible();
    await expect(page.getByText("WASD move")).toBeVisible();
    await expect(page.getByText("Mouse look")).toBeVisible();
    await expect(page.getByText(/Support exactly these context actions/)).toHaveCount(0);
    await expect(page.getByLabel(/Describe the disaster situation/)).toHaveCount(0);
  });

  test("fails closed and offers retry when no reviewed live world can start", async ({ page }) => {
    await page.route("**/api/happy-oyster-session", (route) => route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "MISSING_WORLD_ID", message: "Reviewed Happy Oyster world is unavailable." }),
    }));
    await page.goto("/");
    await page.getByRole("button", { name: "Begin live scenario" }).click();

    await expect(page.getByRole("heading", { name: "The scenario did not start." })).toBeVisible();
    await expect(page.getByText("Reviewed Happy Oyster world is unavailable.")).toBeVisible();
    await expect(page.getByText("CONNECTION FAILED")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry live connection" })).toBeVisible();
    await expect(page.getByText(/fallback/i)).toHaveCount(0);
  });

  test("keeps the primary call to action inside a phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const button = page.getByRole("button", { name: "Begin live scenario" });
    await expect(button).toBeVisible();
    const bounds = await button.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  });

  test("exposes a development world builder without creating a world on load", async ({ page }) => {
    await page.goto("/world-lab");
    await expect(page.getByRole("heading", { name: "Happy Oyster apartment world lab" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Build and validate world" })).toBeVisible();
    await expect(page.getByText("Not created yet")).toBeVisible();
  });
});
