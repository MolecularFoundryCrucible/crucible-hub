import { expect, test } from "../fixtures"

test("staged member commit flow", async ({ page }) => {
  await page.goto(
    "/hub/instruments/01J6Y8N4Q2R7M9K3T5V0W1X2Z4/settings?scenario=populated"
  )
  await page.waitForLoadState("networkidle")

  await page.getByRole("button", { name: "Add member" }).click()

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
  await stagedRole.selectOption({ label: "Editor" })

  await dialog.getByRole("button", { name: "Add member" }).click()

  await expect(dialog).toBeHidden()
  await expect(
    page.getByRole("list", { name: "Instrument direct access" })
  ).toContainText("Jamie Patel")
})

test("staged project member commit flow", async ({ page }) => {
  await page.goto(
    "/hub/projects/01J6Y8N4Q2R7M9K3T5V0W1X2Z3/settings?scenario=populated"
  )
  await page.waitForLoadState("networkidle")

  await page.getByRole("button", { name: "Add member" }).click()

  const dialog = page.getByRole("dialog", { name: "Add member" })
  const input = dialog.getByRole("combobox", { name: "Search people" })
  await input.click()
  await input.pressSequentially("jam")

  const option = page.getByRole("option", { name: /Jamie Patel/i }).first()
  await expect(option).toBeVisible()
  await option.click()

  const stagedList = dialog.getByRole("list", { name: "Members to add" })
  await expect(stagedList).toBeVisible()
  await expect(stagedList).toContainText("Jamie Patel")

  await dialog.getByRole("button", { name: "Add member" }).click()

  await expect(dialog).toBeHidden()
  await expect(
    page.getByRole("list", { name: "Project members" })
  ).toContainText("Jamie Patel")
})

test("manage page staged direct-access flow", async ({ page }) => {
  await page.goto(
    "/hub/datasets/01J6Y8N4Q2R7M9K3T5V0W1X2Z7/manage?scenario=populated"
  )
  await page.waitForLoadState("networkidle")

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

test("project membership locked removal state", async ({ page }) => {
  await page.goto(
    "/hub/projects/01J6Y8N4Q2R7M9K3T5V0W1X2Z3/settings?scenario=populated"
  )
  await page.waitForLoadState("networkidle")

  await page.getByRole("button", { name: "Manage members" }).click()

  await expect(
    page.getByRole("img", { name: "The manager cannot be removed here" })
  ).toBeVisible()
})
