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

test("project Settings edits descriptive identity through the capability-gated route", async ({
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
    page.getByRole("link", { name: "Settings", exact: true })
  ).toBeVisible()
  await page.getByRole("link", { name: "Settings", exact: true }).click()
  await expect(page).toHaveURL(
    new RegExp(`/hub/projects/${projectMfid}/settings`)
  )
  const settingsSections = page.getByRole("navigation", {
    name: "Project settings sections",
  })
  await expect(
    settingsSections.getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page")
  await expect(
    settingsSections.getByRole("link", { name: "Members", exact: true })
  ).toHaveAttribute(
    "href",
    new RegExp(`/projects/${projectMfid}/settings/members`)
  )

  const card = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("General", { exact: true }) })
  await expect(card.getByLabel("Title", { exact: true })).toHaveValue(
    "Operando Catalyst Mapping"
  )
  await card.getByLabel("Title", { exact: true }).fill("Operando mapping")
  await card.getByRole("button", { name: "Save changes", exact: true }).click()

  await expect.poll(() => mutationRequests.length).toBe(1)
  await expect(
    page.getByRole("heading", { level: 1, name: "Operando mapping" })
  ).toBeVisible()
  expect(liveApiRequests).toEqual([])
})

test("failed project Settings edits retain the inline draft", async ({
  page,
}) => {
  await page.goto(`/hub/projects/${projectMfid}/settings?scenario=populated`)
  await page.waitForLoadState("networkidle")

  const card = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("General", { exact: true }) })
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
    new RegExp(`/hub/projects/${projectMfid}/settings`)
  )
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

  const settingsUrl = `/hub/projects/${projectMfid}/settings/members?scenario=populated`
  await page.goto(settingsUrl)
  await page.waitForLoadState("networkidle")

  let membersCard = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Members", { exact: true }) })
  await membersCard.getByRole("button", { name: "Add member" }).click()
  const addDialog = page.getByRole("dialog", { name: "Add member" })
  await addDialog
    .getByRole("searchbox", { name: "Search people" })
    .fill("Jamie")
  await addDialog.getByLabel("Project role").selectOption("contributor")
  expect(
    (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
      .violations
  ).toEqual([])
  await addDialog.getByRole("button", { name: "Add Jamie Patel" }).click()
  await expect(addDialog).toBeHidden()
  await expect(
    membersCard.getByText("Jamie Patel", { exact: true })
  ).toBeVisible()

  await page.goto(settingsUrl)
  await page.waitForLoadState("networkidle")
  membersCard = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Members", { exact: true }) })
  await membersCard.getByRole("button", { name: "Edit roles" }).click()
  const collaboratorRole = membersCard.getByLabel("Role for Morgan Lee")
  await collaboratorRole.selectOption("contributor")
  await expect(collaboratorRole).toHaveValue("contributor")

  await page.goto(settingsUrl)
  await page.waitForLoadState("networkidle")
  membersCard = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Members", { exact: true }) })
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

test("instrument Settings preserves descriptive fields and updates the exact detail", async ({
  page,
}) => {
  await page.goto(
    `/hub/instruments/${instrumentMfid}/settings?scenario=populated`
  )
  await page.waitForLoadState("networkidle")

  const card = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Instrument settings", { exact: true }) })
  await expect(card.getByLabel("Other ID", { exact: true })).toHaveValue("")
  await card.getByLabel("Name", { exact: true }).fill("Updated microprobe")
  await card.getByLabel("Other ID", { exact: true }).fill("facility-42")
  await card.getByRole("button", { name: "Save changes", exact: true }).click()

  await expect(
    page.getByRole("heading", { level: 1, name: "Updated microprobe" })
  ).toBeVisible()
  await expect(card.getByLabel("Other ID", { exact: true })).toHaveValue(
    "facility-42"
  )
})

test("dirty instrument Settings edits block section navigation", async ({
  page,
}) => {
  await page.goto(
    `/hub/instruments/${instrumentMfid}/settings?scenario=populated`
  )
  await page.waitForLoadState("networkidle")

  const card = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Instrument settings", { exact: true }) })
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
    new RegExp(`/hub/instruments/${instrumentMfid}/settings`)
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
