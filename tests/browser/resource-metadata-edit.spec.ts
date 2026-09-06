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

function metadataCard(page: Page) {
  return page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Scientific metadata", { exact: true }) })
}

test("sample scientific metadata edits preserve nested JSON value types", async ({
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

  await page.goto(`/hub/samples/${sampleMfid}?scenario=populated`)
  await page.waitForLoadState("networkidle")
  const card = metadataCard(page)
  await card
    .getByRole("button", { name: "Edit scientific metadata", exact: true })
    .click()
  await card.getByLabel("Scientific metadata", { exact: true }).fill(`{
  "substrate": "carbon paper",
  "electrolyte": "1 M KOH",
  "nominal_iron_fraction": 0.2,
  "conditions": {
    "temperature_k": 298.15,
    "vacuum": false
  },
  "labels": ["operando", null, true],
  "run_number": 7
}`)
  await card
    .getByRole("button", { name: "Save scientific metadata", exact: true })
    .click()

  await expect(
    card.getByRole("button", { name: "Edit scientific metadata", exact: true })
  ).toBeVisible()
  await expect(card.getByText("run_number", { exact: true })).toBeVisible()
  await expect(card.getByText("7", { exact: true })).toBeVisible()
  await expect(card.getByText("labels", { exact: true })).toBeVisible()
  await expect(card.getByText("3 items", { exact: true })).toBeVisible()
  await card.locator("summary[aria-label='conditions: 2 fields']").click()
  await expect(card.getByText("298.15", { exact: true })).toBeVisible()
  await expect(card.getByText("false", { exact: true })).toBeVisible()
  expect(mutationRequests).toHaveLength(1)
  expect(liveApiRequests).toEqual([])
})

test("top-level metadata removal asks for replacement confirmation", async ({
  page,
}) => {
  await page.goto(`/hub/samples/${sampleMfid}?scenario=populated`)
  await page.waitForLoadState("networkidle")
  const card = metadataCard(page)
  await card
    .getByRole("button", { name: "Edit scientific metadata", exact: true })
    .click()
  await card.getByLabel("Scientific metadata", { exact: true }).fill(`{
  "substrate": "carbon paper"
}`)
  await card
    .getByRole("button", { name: "Save scientific metadata", exact: true })
    .click()

  const dialog = page.getByRole("dialog")
  await expect(
    dialog.getByRole("heading", { name: "Replace scientific metadata?" })
  ).toBeVisible()
  await expect(dialog).toContainText("replace all scientific metadata")
  await dialog
    .getByRole("button", { name: "Keep editing", exact: true })
    .click()
  await expect(
    card.getByLabel("Scientific metadata", { exact: true })
  ).toHaveValue(/substrate/)

  await card
    .getByRole("button", { name: "Save scientific metadata", exact: true })
    .click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Replace metadata", exact: true })
    .click()
  await expect(card.getByText("substrate", { exact: true })).toBeVisible()
  await expect(card.getByText("electrolyte", { exact: true })).toHaveCount(0)
})

test("dataset scientific metadata uses the shared type-preserving editor", async ({
  page,
}) => {
  await page.goto(`/hub/datasets/${datasetMfid}?scenario=populated`)
  await page.waitForLoadState("networkidle")
  const card = metadataCard(page)
  await card
    .getByRole("button", { name: "Edit scientific metadata", exact: true })
    .click()
  const metadata = card.getByLabel("Scientific metadata", { exact: true })
  const current = JSON.parse(await metadata.inputValue()) as Record<
    string,
    unknown
  >
  await metadata.fill(
    JSON.stringify({ ...current, calibration_revision: 3 }, null, 2)
  )
  await card
    .getByRole("button", { name: "Save scientific metadata", exact: true })
    .click()

  await expect(
    card.getByRole("button", { name: "Edit scientific metadata", exact: true })
  ).toBeVisible()
  await expect(
    card.getByText("calibration_revision", { exact: true })
  ).toBeVisible()
  await expect(card.getByText("3", { exact: true })).toBeVisible()
})

test("failed scientific metadata edit retains its draft", async ({ page }) => {
  await page.goto(`/hub/samples/${sampleMfid}?scenario=populated`)
  await page.waitForLoadState("networkidle")
  const card = metadataCard(page)
  await card
    .getByRole("button", { name: "Edit scientific metadata", exact: true })
    .click()
  const metadata = card.getByLabel("Scientific metadata", { exact: true })
  await metadata.fill(`{
  "substrate": "carbon paper",
  "electrolyte": "1 M KOH",
  "nominal_iron_fraction": 0.2,
  "draft": {"nested": true}
}`)

  let failedMutation = false
  await page.route("**/hub/_serverFn/**", async (route) => {
    if (!failedMutation && serverFunctionPost(route.request())) {
      failedMutation = true
      await route.abort("failed")
      return
    }
    await route.continue()
  })
  await card
    .getByRole("button", { name: "Save scientific metadata", exact: true })
    .click()

  await expect(card.getByRole("alert")).toHaveText(
    "Scientific metadata could not be saved. Your changes are still here."
  )
  await expect(metadata).toHaveValue(/"draft": \{"nested": true\}/)
})

test("dirty scientific metadata edits block navigation until discarded", async ({
  page,
}) => {
  await page.goto(`/hub/samples/${sampleMfid}?scenario=populated`)
  await page.waitForLoadState("networkidle")
  const card = metadataCard(page)
  await card
    .getByRole("button", { name: "Edit scientific metadata", exact: true })
    .click()
  await card
    .getByLabel("Scientific metadata", { exact: true })
    .fill('{"draft": 1}')
  await page.getByRole("link", { name: "Data", exact: true }).first().click()

  const dialog = page.getByRole("dialog")
  await expect(
    dialog.getByRole("heading", { name: "Discard unsaved changes?" })
  ).toBeVisible()
  await dialog
    .getByRole("button", { name: "Keep editing", exact: true })
    .click()
  await expect(
    card.getByLabel("Scientific metadata", { exact: true })
  ).toHaveValue('{"draft": 1}')

  await page.getByRole("link", { name: "Data", exact: true }).first().click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Discard changes", exact: true })
    .click()
  await expect(page).toHaveURL(/\/hub\/data/)
})

test("false resource edit capability hides the metadata editor action", async ({
  page,
}) => {
  await page.goto(`/hub/samples/${restrictedSampleMfid}?scenario=populated`)
  await page.waitForLoadState("networkidle")
  await expect(
    metadataCard(page).getByRole("button", {
      name: "Edit scientific metadata",
      exact: true,
    })
  ).toHaveCount(0)
})

test("compact dark scientific metadata editing is accessible and does not overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" })
  await page.addInitScript(() => {
    localStorage.setItem("crucible-hub-theme", "dark")
  })
  await page.goto(`/hub/samples/${sampleMfid}?scenario=populated`)
  await page.waitForLoadState("networkidle")
  const card = metadataCard(page)
  await card
    .getByRole("button", { name: "Edit scientific metadata", exact: true })
    .click()

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
