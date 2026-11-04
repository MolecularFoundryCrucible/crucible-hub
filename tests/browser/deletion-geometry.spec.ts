import { expect, test } from "../fixtures"

test("deletion dialog opens with final geometry", async ({ page }) => {
  await page.goto(
    "/hub/instruments/01J6Y8N4Q2R7M9K3T5V0W1X2Z4/settings?scenario=populated"
  )
  await page.waitForLoadState("networkidle")

  const deleteButton = page.getByRole("button", {
    name: /Delete .* permanently/i,
  })
  await expect(deleteButton).toBeVisible()
  await deleteButton.click()

  const dialog = page.getByRole("dialog", { name: "Delete permanently?" })
  await expect(dialog).toBeVisible()

  await expect(
    dialog.getByText(/Deletion is blocked: \d+ datasets? still assigned/i)
  ).toBeVisible()
  await expect(
    dialog.getByText(/Reviewing what this deletion removes/i)
  ).toHaveCount(0)
  await expect(
    dialog.getByRole("button", { name: "Delete permanently", exact: true })
  ).toBeDisabled()
})
