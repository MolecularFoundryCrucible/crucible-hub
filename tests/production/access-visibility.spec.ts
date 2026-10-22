import { expect, test } from "../fixtures"

test("shows who has access read-only to a member who cannot manage it", async ({
  page,
}) => {
  await page.goto(
    "/hub/samples/01J6Y8N4Q2R7M9K3T5V0W1X2Z6/manage?scenario=populated"
  )
  await page.waitForLoadState("networkidle")

  await expect(
    page.getByText("Access management", { exact: true })
  ).toBeVisible()
  await expect(page.getByText("Direct access")).toBeVisible()
  await expect(page.getByRole("button", { name: "Manage access" })).toHaveCount(
    0
  )
  await expect(page.getByText("Access management is unavailable")).toHaveCount(
    0
  )
})

test("shows instrument people on the Overview", async ({ page }) => {
  await page.goto(
    "/hub/instruments/01J6Y8N4Q2R7M9K3T5V0W1X2Z4/overview?scenario=populated"
  )
  await page.waitForLoadState("networkidle")

  await expect(page.getByText("People", { exact: true })).toBeVisible()
  await expect(page.getByText("Manager", { exact: true })).toBeVisible()
})
