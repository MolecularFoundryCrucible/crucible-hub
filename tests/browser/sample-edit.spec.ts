import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"

import { expect, test } from "../fixtures"

const sampleMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z5"
const restrictedSampleMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z6"
const datasetMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z7"

function serverFunctionPost(request: {
  method: () => string
  url: () => string
}) {
  return (
    request.method() === "POST" && request.url().includes("/hub/_serverFn/")
  )
}

function summaryCard(page: Page) {
  return titledCard(page, "Summary")
}

function titledCard(page: Page, title: string) {
  return page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText(title, { exact: true }) })
}

test("sample Summary edits stay on the canonical resource page", async ({
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
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          sessionStorage.setItem("copied-mfid", value)
        },
      },
    })
  })

  await page.goto(`/hub/samples/${sampleMfid}?scenario=populated`)
  await page.waitForLoadState("networkidle")
  const card = summaryCard(page)
  const identity = titledCard(page, "Identity")
  await expect(card.getByText("Project", { exact: true })).toBeVisible()
  await expect(card.getByText("Visibility", { exact: true })).toHaveCount(0)
  await expect(card.getByText("Timestamp", { exact: true })).toBeVisible()
  await expect(
    card.getByText("Operando Catalyst Mapping", {
      exact: true,
    })
  ).toBeVisible()
  await expect(card.locator('[data-resource-type="project"]')).toBeVisible()
  await expect(card.locator("[data-summary-field-icon]")).toHaveCount(3)
  await expect(card.getByText("Instrument", { exact: true })).toHaveCount(0)
  await expect(titledCard(page, "Context")).toHaveCount(0)
  await expect(page.locator('main [data-slot="card-title"]')).toHaveText([
    "Summary",
    "Identity",
    "Relationships",
    "Scientific metadata",
  ])
  await expect(identity.getByText("Visibility", { exact: true })).toBeVisible()
  await expect(identity.getByText("Private", { exact: true })).toBeVisible()
  await expect(
    page.locator("main > header").getByText("Private", { exact: true })
  ).toHaveCount(0)
  const ownerLink = identity.getByRole("link", { name: "A. Chen" })
  await expect(ownerLink).toHaveAttribute(
    "href",
    new RegExp(`/hub/people/0000-0000-0000-000X`)
  )
  await ownerLink.hover()
  await expect(page.getByText("Avery Chen", { exact: true })).toBeVisible()
  await expect(page.getByText("@avery.chen", { exact: true })).toBeVisible()
  await identity.getByRole("button", { name: "Copy MFID" }).click()
  await expect(
    identity.getByRole("button", { name: "MFID copied" })
  ).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("copied-mfid")))
    .toBe(sampleMfid)
  await card.getByRole("button", { name: "Edit summary", exact: true }).click()

  await card.getByLabel("Name", { exact: true }).fill("Updated NiFe catalyst")
  await card
    .getByLabel("Sample type", { exact: true })
    .fill("updated-electrocatalyst")
  await card
    .getByLabel("Description", { exact: true })
    .fill("Updated descriptive context for the sample.")
  await expect(card.getByLabel("Timestamp", { exact: true })).toHaveAttribute(
    "type",
    "datetime-local"
  )

  const saveButton = card.getByRole("button", {
    name: "Save changes",
    exact: true,
  })
  const beforeSave = await saveButton.boundingBox()
  expect(beforeSave).not.toBeNull()

  let releaseMutation = () => {}
  const mutationHeld = new Promise<void>((resolve) => {
    releaseMutation = resolve
  })
  await page.route("**/hub/_serverFn/**", async (route) => {
    if (serverFunctionPost(route.request())) await mutationHeld
    await route.continue()
  })

  await saveButton.click()
  await expect(
    card.getByRole("button", { name: "Saving changes" })
  ).toBeVisible()
  const duringSave = await card.locator('button[type="submit"]').boundingBox()
  expect(duringSave).not.toBeNull()
  expect(duringSave?.width).toBe(beforeSave?.width)
  expect(duringSave?.height).toBe(beforeSave?.height)
  releaseMutation()

  await expect(page).toHaveURL(new RegExp(`/hub/samples/${sampleMfid}`))
  await expect(
    page.getByRole("heading", { level: 1, name: "Updated NiFe catalyst" })
  ).toBeVisible()
  const updatedCard = summaryCard(page)
  await expect(
    updatedCard.getByText("updated-electrocatalyst", { exact: true })
  ).toBeVisible()
  await expect(
    updatedCard.getByText("Updated descriptive context for the sample.", {
      exact: true,
    })
  ).toBeVisible()
  expect(mutationRequests).toHaveLength(1)
  expect(liveApiRequests).toEqual([])
})

test("failed sample Summary edits retain the inline draft", async ({
  page,
}) => {
  await page.goto(`/hub/samples/${sampleMfid}?scenario=populated`)
  await page.waitForLoadState("networkidle")
  const card = summaryCard(page)
  await card.getByRole("button", { name: "Edit summary", exact: true }).click()
  await card
    .getByLabel("Name", { exact: true })
    .fill("Draft kept after failure")
  await card
    .getByLabel("Description", { exact: true })
    .fill("Draft description")

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
    "The sample could not be saved. Your changes are still here."
  )
  await expect(card.getByLabel("Name", { exact: true })).toHaveValue(
    "Draft kept after failure"
  )
  await expect(card.getByLabel("Description", { exact: true })).toHaveValue(
    "Draft description"
  )
  await expect(page).toHaveURL(new RegExp(`/hub/samples/${sampleMfid}`))
})

test("sample Summary Cancel keeps or discards edits without navigation", async ({
  page,
}) => {
  await page.goto(`/hub/samples/${sampleMfid}?scenario=populated`)
  await page.waitForLoadState("networkidle")
  const card = summaryCard(page)
  await card.getByRole("button", { name: "Edit summary", exact: true }).click()
  await card.getByLabel("Name", { exact: true }).fill("Unsaved sample draft")
  await card.getByRole("button", { name: "Cancel", exact: true }).click()

  const dialog = page.getByRole("dialog")
  await expect(
    dialog.getByRole("heading", { name: "Discard unsaved changes?" })
  ).toBeVisible()
  await dialog
    .getByRole("button", { name: "Keep editing", exact: true })
    .click()
  await expect(page).toHaveURL(new RegExp(`/hub/samples/${sampleMfid}`))
  await expect(card.getByLabel("Name", { exact: true })).toHaveValue(
    "Unsaved sample draft"
  )

  await card.getByRole("button", { name: "Cancel", exact: true }).click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Discard changes", exact: true })
    .click()
  await expect(page).toHaveURL(new RegExp(`/hub/samples/${sampleMfid}`))
  await expect(
    page.getByRole("heading", { level: 1, name: "NiFe oxide catalyst A" })
  ).toBeVisible()
  await expect(
    summaryCard(page).getByRole("button", { name: "Edit summary", exact: true })
  ).toBeVisible()
})

test("dirty Summary edits block route navigation", async ({ page }) => {
  await page.goto(`/hub/samples/${sampleMfid}?scenario=populated`)
  await page.waitForLoadState("networkidle")
  const card = summaryCard(page)
  await card.getByRole("button", { name: "Edit summary", exact: true }).click()
  await card
    .getByLabel("Name", { exact: true })
    .fill("Unsaved navigation draft")
  await page.getByRole("link", { name: "Data", exact: true }).first().click()

  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await dialog
    .getByRole("button", { name: "Keep editing", exact: true })
    .click()
  await expect(page).toHaveURL(new RegExp(`/hub/samples/${sampleMfid}`))
  await expect(card.getByLabel("Name", { exact: true })).toHaveValue(
    "Unsaved navigation draft"
  )

  await page.getByRole("link", { name: "Data", exact: true }).first().click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Discard changes", exact: true })
    .click()
  await expect(page).toHaveURL(/\/hub\/data/)
})

test("false sample edit capability hides the Summary Edit button", async ({
  page,
}) => {
  await page.goto(`/hub/samples/${restrictedSampleMfid}?scenario=populated`)
  await page.waitForLoadState("networkidle")
  await expect(
    summaryCard(page).getByRole("button", { name: "Edit summary", exact: true })
  ).toHaveCount(0)
  await expect(summaryCard(page).getByText("-", { exact: true })).toBeVisible()
})

test("dataset Summary edits only expose descriptive fields", async ({
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

  await page.goto(`/hub/datasets/${datasetMfid}?scenario=populated`)
  await page.waitForLoadState("networkidle")
  const card = summaryCard(page)
  await expect(
    card.getByText("Operando Catalyst Mapping", {
      exact: true,
    })
  ).toBeVisible()
  await expect(card.getByText("Instrument", { exact: true })).toBeVisible()
  await expect(titledCard(page, "Context")).toHaveCount(0)
  await expect(
    titledCard(page, "Identity").getByText("Visibility", { exact: true })
  ).toBeVisible()
  await expect(
    titledCard(page, "Identity").getByText("Private", { exact: true })
  ).toBeVisible()
  await expect(
    page.locator("main > header").getByText("Private", { exact: true })
  ).toHaveCount(0)
  await expect(card.getByText("Project", { exact: true })).toBeVisible()
  await expect(card.getByText("Visibility", { exact: true })).toHaveCount(0)
  await expect(page.locator('main [data-slot="card-title"]')).toHaveText([
    "Summary",
    "Identity",
    "Files",
    "Relationships",
    "Scientific metadata",
  ])
  await card.getByRole("button", { name: "Edit summary", exact: true }).click()

  for (const label of [
    "Name",
    "Measurement",
    "Data format",
    "Data type",
    "Session",
    "Timestamp",
  ]) {
    await expect(card.getByLabel(label, { exact: true })).toBeVisible()
  }
  for (const excluded of ["Visibility", "Scientific metadata", "Access"]) {
    await expect(card.getByText(excluded, { exact: true })).toHaveCount(0)
  }
  await expect(card.locator("textarea")).toHaveCount(0)

  await card.getByLabel("Name", { exact: true }).fill("Updated operando series")
  await card
    .getByLabel("Measurement", { exact: true })
    .fill("Updated X-ray absorption")
  await card.getByLabel("Data format", { exact: true }).fill("Updated HDF5")
  await card.getByLabel("Data type", { exact: true }).fill("updated spectrum")
  await card.getByLabel("Session", { exact: true }).fill("updated-cycle")

  await card.getByRole("button", { name: "Save changes", exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/hub/datasets/${datasetMfid}`))
  await expect(
    page.getByRole("heading", { level: 1, name: "Updated operando series" })
  ).toBeVisible()
  const updatedCard = summaryCard(page)
  for (const value of [
    "Updated X-ray absorption",
    "Updated HDF5",
    "updated spectrum",
    "updated-cycle",
  ]) {
    await expect(updatedCard.getByText(value, { exact: true })).toBeVisible()
  }
  expect(mutationRequests).toHaveLength(1)
  expect(liveApiRequests).toEqual([])
})

test("compact dark Summary editing is accessible and does not overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" })
  await page.addInitScript(() => {
    localStorage.setItem("crucible-hub-theme", "dark")
  })
  await page.goto(`/hub/samples/${sampleMfid}?scenario=populated`)
  await page.waitForLoadState("networkidle")
  const card = summaryCard(page)
  await card.getByRole("button", { name: "Edit summary", exact: true }).click()
  await expect(card.getByText("Editing", { exact: true })).toBeVisible()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
    )
    .toBe(true)
  await expect(new AxeBuilder({ page }).analyze()).resolves.toMatchObject({
    violations: [],
  })
})
