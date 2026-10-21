import { expect, test } from "../fixtures"

test("opens instrument datasets in the preview panel", async ({ page }) => {
  await page.goto("/hub/instruments/01J6Y8N4Q2R7M9K3T5V0W1X2Z4")
  await page.waitForLoadState("networkidle")
  await page
    .getByRole("main")
    .getByRole("link", { name: "Activated catalyst morphology" })
    .first()
    .click()

  await expect(page).toHaveURL(
    /\/hub\/instruments\/01J6Y8N4Q2R7M9K3T5V0W1X2Z4\?.*preview=01J6Y8N4Q2R7M9K3T5V0W1X2Z9/
  )
  const inspector = page.locator('[data-slot="sheet-content"]')
  await expect(
    inspector.getByRole("heading", { name: "Activated catalyst morphology" })
  ).toBeVisible()

  await inspector.getByRole("button", { name: "Close" }).click()
  await expect(page).toHaveURL(
    /\/hub\/instruments\/01J6Y8N4Q2R7M9K3T5V0W1X2Z4$/
  )
})
