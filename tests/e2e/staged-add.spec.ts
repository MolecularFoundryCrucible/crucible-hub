import { expect, test } from "../fixtures"

test("manage page staged direct-access flow", async ({ page }) => {
  await page.goto(
    "/hub/datasets/01J6Y8N4Q2R7M9K3T5V0W1X2Z7/manage?scenario=populated"
  )
  await page.waitForLoadState("networkidle")

  await page.getByRole("button", { name: "Edit access" }).click()
  await page.getByRole("button", { name: "Add access" }).click()

  const dialog = page.getByRole("dialog", { name: "Add direct access" })
  const input = dialog.getByRole("combobox", { name: "Search people" })
  await input.click()
  await input.pressSequentially("jam")

  const option = page.getByRole("option", { name: /Jamie Patel/i }).first()
  await expect(option).toBeVisible()
  await option.click()

  const stagedList = dialog.getByRole("list", { name: "Members to add" })
  await expect(stagedList).toBeVisible()
  await expect(stagedList).toContainText("Jamie Patel")

  const stagedRole = stagedList.getByRole("combobox", {
    name: "Role for Jamie Patel",
  })
  await stagedRole.selectOption({ label: "Viewer" })

  await dialog.getByRole("button", { name: "Add member" }).click()

  await expect(dialog).toBeHidden()
  await expect(
    page.getByRole("list", { name: "Direct access grants" })
  ).toContainText("Jamie Patel")
})
