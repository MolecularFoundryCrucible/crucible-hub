import { expect, test } from "../fixtures"

test("batch member removal flow", async ({ page }) => {
  await page.goto(
    "/hub/projects/01J6Y8N4Q2R7M9K3T5V0W1X2Z3/settings?scenario=populated"
  )
  await page.waitForLoadState("networkidle")

  await page.getByRole("button", { name: "Manage members" }).click()

  const memberList = page.getByRole("list", { name: "Project members" })
  const lockedIdentity = await memberList.getByText("Avery Chen").boundingBox()
  const removableIdentity = await memberList
    .getByText("Morgan Lee")
    .boundingBox()
  expect(
    Math.abs((lockedIdentity?.x ?? 0) - (removableIdentity?.x ?? 0))
  ).toBeLessThan(2)

  await page
    .getByRole("checkbox", { name: "Select Morgan Lee for removal" })
    .click()
  await page
    .getByRole("checkbox", { name: "Select Beamline Collector for removal" })
    .click()

  await page.getByRole("button", { name: "Remove 2 members" }).click()

  const dialog = page.getByRole("dialog", { name: "Remove members?" })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText("Morgan Lee")
  await expect(dialog).toContainText("Beamline Collector")

  await dialog.getByRole("button", { name: "Remove 2 members" }).click()

  await expect(dialog).toBeHidden()
  await expect(memberList).not.toContainText("Beamline Collector")
})
