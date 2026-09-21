import AxeBuilder from "@axe-core/playwright"

import { expect, test } from "../fixtures"

const projectMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z3"
const restrictedProjectMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2ZB"
const instrumentMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z4"

function serverFunctionPost(request: {
  method: () => string
  url: () => string
}) {
  return (
    request.method() === "POST" && request.url().includes("/hub/_serverFn/")
  )
}

test("project Overview edits descriptive identity through an explicit action", async ({
  page,
}) => {
  const mutationRequests: string[] = []
  const liveApiRequests: string[] = []
  page.on("request", (request) => {
    if (serverFunctionPost(request)) mutationRequests.push(request.url())
    if (/crucible\.lbl\.gov|testapi|staging/i.test(request.url())) {
      liveApiRequests.push(request.url())
    }
  })

  await page.goto(`/hub/projects/${projectMfid}?scenario=populated`)
  await page.waitForLoadState("networkidle")
  await expect(
    page.getByRole("link", { name: "Manage", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Settings", exact: true })
  ).toHaveCount(0)
  await page.getByRole("link", { name: "Overview", exact: true }).click()

  let card = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Project details", { exact: true }) })
  await card.getByRole("button", { name: "Edit project" }).click()
  card = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Edit project", { exact: true }) })
  await expect(card.getByLabel("Title", { exact: true })).toHaveValue(
    "Operando Catalyst Mapping"
  )
  await card.getByLabel("Title", { exact: true }).fill("Operando mapping")
  await card.getByRole("button", { name: "Save changes", exact: true }).click()

  await expect.poll(() => mutationRequests.length).toBe(1)
  await expect(
    page.getByRole("heading", { level: 1, name: "Operando mapping" })
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Edit project" })).toBeVisible()
  expect(liveApiRequests).toEqual([])
})

test("failed project Overview edits retain the inline draft", async ({
  page,
}) => {
  await page.goto(`/hub/projects/${projectMfid}/overview?scenario=populated`)
  await page.waitForLoadState("networkidle")

  await page.getByRole("button", { name: "Edit project" }).click()
  const card = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Edit project", { exact: true }) })
  await card
    .getByLabel("Title", { exact: true })
    .fill("Draft kept after failure")

  let failedMutation = false
  await page.route("**/hub/_serverFn/**", async (route) => {
    if (!failedMutation && serverFunctionPost(route.request())) {
      failedMutation = true
      await route.abort("failed")
      return
    }
    await route.continue()
  })

  await card.getByRole("button", { name: "Save changes", exact: true }).click()
  await expect(card.getByRole("alert")).toHaveText(
    "The project could not be saved. Your changes are still here."
  )
  await expect(card.getByLabel("Title", { exact: true })).toHaveValue(
    "Draft kept after failure"
  )
  await expect(page).toHaveURL(
    new RegExp(`/hub/projects/${projectMfid}/overview`)
  )
})

test("project and instrument Manage indexes render unified management", async ({
  page,
}) => {
  await page.goto(`/hub/projects/${projectMfid}/settings?scenario=populated`)
  await expect(page).toHaveURL(
    new RegExp(`/hub/projects/${projectMfid}/settings`)
  )
  await expect(
    page.getByRole("link", { name: "Manage", exact: true })
  ).toHaveAttribute("aria-current", "page")
  await expect(page.getByText("General", { exact: true })).toHaveCount(0)

  await page.goto(
    `/hub/instruments/${instrumentMfid}/settings?scenario=populated`
  )
  await expect(page).toHaveURL(
    new RegExp(`/hub/instruments/${instrumentMfid}/settings`)
  )
  await expect(
    page.getByRole("link", { name: "Manage", exact: true })
  ).toHaveAttribute("aria-current", "page")
  await expect(page.getByText("General", { exact: true })).toHaveCount(0)
})

test("project Settings manages direct membership through confirmed API-shaped operations", async ({
  page,
}) => {
  const liveApiRequests: string[] = []
  page.on("request", (request) => {
    if (/crucible\.lbl\.gov|testapi|staging/i.test(request.url())) {
      liveApiRequests.push(request.url())
    }
  })

  const settingsUrl = `/hub/projects/${projectMfid}/settings?scenario=populated`
  await page.goto(settingsUrl)
  await page.waitForLoadState("networkidle")

  let membersCard = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Access management", { exact: true }) })
  const addMemberButton = membersCard.getByRole("button", {
    name: "Add member",
  })
  await addMemberButton.click()
  const addDialog = page.getByRole("dialog", { name: "Add member" })
  await addDialog
    .getByRole("searchbox", { name: "Search people" })
    .fill("Jamie")
  await addDialog.getByLabel("Project role").selectOption("contributor")
  expect(
    (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
      .violations
  ).toEqual([])
  await addDialog.getByRole("button", { name: "Select Jamie Patel" }).click()
  await addDialog.getByRole("button", { name: "Add member" }).click()
  await expect(addDialog).toBeHidden()
  await expect(
    membersCard.getByText("Jamie Patel", { exact: true })
  ).toBeVisible()

  await page.goto(settingsUrl)
  await page.waitForLoadState("networkidle")
  membersCard = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Access management", { exact: true }) })
  await membersCard.getByRole("button", { name: "Manage members" }).click()
  const collaboratorRole = membersCard.getByLabel("Role for Morgan Lee")
  await collaboratorRole.selectOption("contributor")
  await expect(collaboratorRole).toHaveValue("contributor")

  await page.goto(settingsUrl)
  await page.waitForLoadState("networkidle")
  membersCard = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Access management", { exact: true }) })
  await membersCard.getByRole("button", { name: "Manage members" }).click()
  await membersCard.getByRole("button", { name: "Remove Morgan Lee" }).click()
  const removeDialog = page.getByRole("alertdialog", {
    name: "Remove member?",
  })
  await removeDialog.getByRole("button", { name: "Remove member" }).click()
  await expect(removeDialog).toBeHidden()
  await expect(
    membersCard.getByText("Morgan Lee", { exact: true })
  ).toHaveCount(0)
  await expect(
    membersCard.getByRole("button", { name: "Leave project" })
  ).toHaveCount(0)
  expect(liveApiRequests).toEqual([])
})

for (const theme of ["light", "dark"] as const) {
  test(`keeps the ${theme} Add member action readable`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme })
    await page.addInitScript((selectedTheme) => {
      localStorage.setItem("crucible-hub-theme", selectedTheme)
    }, theme)
    await page.goto(`/hub/projects/${projectMfid}/settings?scenario=populated`)
    await page.waitForLoadState("networkidle")
    await expect(page.locator("html")).toHaveClass(new RegExp(theme))

    expect(
      (
        await new AxeBuilder({ page })
          .include("[data-project-membership-add]")
          .analyze()
      ).violations
    ).toEqual([])
  })
}

test("instrument Overview preserves descriptive fields and updates the exact detail", async ({
  page,
}) => {
  await page.goto(`/hub/instruments/${instrumentMfid}?scenario=populated`)
  await page.waitForLoadState("networkidle")

  await page.getByRole("button", { name: "Edit instrument" }).click()
  let card = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Edit instrument", { exact: true }) })
  await expect(card.getByLabel("Other ID", { exact: true })).toHaveValue("")
  await card.getByLabel("Name", { exact: true }).fill("Updated microprobe")
  await card.getByLabel("Other ID", { exact: true }).fill("facility-42")
  await card.getByRole("button", { name: "Save changes", exact: true }).click()

  await expect(
    page.getByRole("heading", { level: 1, name: "Updated microprobe" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Edit instrument" }).click()
  card = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Edit instrument", { exact: true }) })
  await expect(card.getByLabel("Other ID", { exact: true })).toHaveValue(
    "facility-42"
  )
})

test("instrument Lifecycle applies confirmed status changes and retains failed selections", async ({
  page,
}) => {
  await page.goto(
    `/hub/instruments/${instrumentMfid}/settings?scenario=populated`
  )
  await page.waitForLoadState("networkidle")

  const card = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Lifecycle", { exact: true }) })
  const status = card.getByLabel("Status", { exact: true })
  await expect(status).toHaveValue("active")

  await status.selectOption("maintenance")
  await card.getByRole("button", { name: "Update status" }).click()
  await expect(
    card.locator('[data-slot="badge"]').filter({ hasText: "Maintenance" })
  ).toBeVisible()

  let failDecommission = true
  await page.route("**/hub/_serverFn/**", async (route) => {
    if (failDecommission && serverFunctionPost(route.request())) {
      failDecommission = false
      await route.abort("failed")
      return
    }
    await route.continue()
  })

  await status.selectOption("decommissioned")
  await card.getByRole("button", { name: "Update status" }).click()
  const dialog = page.getByRole("alertdialog", {
    name: "Decommission instrument?",
  })
  await expect(dialog).toBeVisible()
  await dialog.getByRole("button", { name: "Decommission" }).click()
  await expect(dialog.getByRole("alert")).toContainText(
    /instrument status could not be changed/i
  )
  await expect(status).toHaveValue("decommissioned")

  await dialog.getByRole("button", { name: "Decommission" }).click()
  await expect(dialog).toBeHidden()
  await expect(
    card.locator('[data-slot="badge"]').filter({ hasText: "Decommissioned" })
  ).toBeVisible()
})

test("instrument access shows its manager and unassigns an operator after confirmation", async ({
  page,
}) => {
  await page.goto(
    `/hub/instruments/${instrumentMfid}/settings?scenario=populated`
  )
  await page.waitForLoadState("networkidle")

  const access = page.getByRole("list", { name: "Instrument direct access" })
  await expect(access.getByText("Avery Chen", { exact: true })).toBeVisible()
  await expect(access.getByText("Manager", { exact: true })).toBeVisible()
  await expect(access.getByText("@beamline-collector")).toBeVisible()
  await expect(access.getByText("Operator", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Manage operators" }).click()
  await expect(
    page.getByRole("button", { name: "Finish managing operators" })
  ).toBeVisible()
  await access
    .getByRole("button", { name: "Unassign @beamline-collector" })
    .click()

  const dialog = page.getByRole("alertdialog", { name: "Unassign operator?" })
  await expect(dialog).toContainText("@beamline-collector")
  await dialog.getByRole("button", { name: "Unassign operator" }).click()
  await expect(dialog).toBeHidden()
  await expect(access.getByText("@beamline-collector")).toHaveCount(0)
})

test("project Ownership previews and confirms the selected person", async ({
  page,
}) => {
  await page.goto(`/hub/projects/${projectMfid}/settings?scenario=populated`)
  await page.waitForLoadState("networkidle")

  await page.getByRole("button", { name: "Choose person" }).click()
  const chooser = page.getByRole("dialog", { name: "Choose a new owner" })
  await chooser.getByLabel("Search people").fill("Jamie")
  await chooser.getByRole("button", { name: /Jamie Patel/ }).click()

  const confirmation = page.getByRole("alertdialog", {
    name: "Transfer ownership?",
  })
  await expect(confirmation).toContainText("Jamie Patel")
  await confirmation.getByRole("button", { name: "Confirm transfer" }).click()
  await expect(confirmation).toBeHidden()
  await expect(
    page.getByText("Transfer ownership", { exact: true })
  ).toHaveCount(0)
})

test("dirty instrument Overview edits block section navigation", async ({
  page,
}) => {
  await page.goto(`/hub/instruments/${instrumentMfid}?scenario=populated`)
  await page.waitForLoadState("networkidle")

  await page.getByRole("button", { name: "Edit instrument" }).click()
  const card = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Edit instrument", { exact: true }) })
  await card
    .getByLabel("Name", { exact: true })
    .fill("Unsaved instrument draft")

  const datasetsLink = page.getByRole("link", {
    name: "Datasets",
    exact: true,
  })
  await datasetsLink.click()

  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await dialog
    .getByRole("button", { name: "Keep editing", exact: true })
    .click()
  await expect(page).toHaveURL(
    new RegExp(`/hub/instruments/${instrumentMfid}(?:[?]|$)`)
  )
  await expect(card.getByLabel("Name", { exact: true })).toHaveValue(
    "Unsaved instrument draft"
  )

  await datasetsLink.click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Discard changes", exact: true })
    .click()
  await expect(page).toHaveURL(
    new RegExp(`/hub/instruments/${instrumentMfid}/datasets`)
  )
})

test("direct project Settings without can_edit reports unavailable and renders no controls", async ({
  page,
}) => {
  await page.goto(
    `/hub/projects/${restrictedProjectMfid}/settings?scenario=restricted`
  )
  await page.waitForLoadState("networkidle")

  await expect(
    page.getByRole("heading", { level: 2, name: "Settings unavailable" })
  ).toBeVisible()
  await expect(page.getByRole("textbox")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(
    0
  )
})
