import AxeBuilder from "@axe-core/playwright"

import { expect, test } from "../fixtures"

const editableSample = "01J6Y8N4Q2R7M9K3T5V0W1X2Z5"
const restrictedSample = "01J6Y8N4Q2R7M9K3T5V0W1X2Z6"
const unlinkedDataset = "01J6Y8N4Q2R7M9K3T5V0W1X2Z9"

test("adds a directed dataset relationship from the canonical page", async ({
  page,
}) => {
  const liveApiRequests: string[] = []
  page.on("request", (request) => {
    if (/crucible\.lbl\.gov|testapi|staging/i.test(request.url())) {
      liveApiRequests.push(request.url())
    }
  })

  await page.goto(`/hub/datasets/${unlinkedDataset}?scenario=populated`)
  await page.waitForLoadState("networkidle")
  const card = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Relationships", { exact: true }) })
  await card
    .getByRole("button", {
      name: "Add relationship to Activated catalyst morphology",
    })
    .click()

  const dialog = page.getByRole("dialog", { name: "Add relationship" })
  await expect(
    dialog
      .locator("strong")
      .filter({ hasText: "Activated catalyst morphology" })
  ).toBeVisible()
  await dialog
    .getByLabel("Relationship")
    .selectOption({ label: "Parent dataset" })
  await dialog.getByLabel("Search datasets").fill("phase")
  await dialog.getByRole("button", { name: "Search", exact: true }).click()
  await dialog.getByRole("button", { name: /NiFe phase evolution/ }).click()
  await expect(dialog).toContainText(
    "NiFe phase evolution will be a parent of Activated catalyst morphology."
  )
  await dialog.getByRole("button", { name: "Add relationship" }).click()

  await expect(dialog).toHaveCount(0)
  await expect(card.getByRole("heading", { name: "Parents (1)" })).toBeVisible()
  await expect(
    card.getByText("NiFe phase evolution", { exact: true })
  ).toBeVisible()
  await expect(
    card.getByRole("link", {
      name: "Open full page: NiFe phase evolution",
    })
  ).toBeVisible()
  await expect(
    card.getByRole("button", { name: "Unlink NiFe phase evolution" })
  ).toHaveCount(0)
  await card
    .getByRole("button", {
      name: "Manage relationships for Activated catalyst morphology",
    })
    .click()
  await expect(
    card.getByRole("link", {
      name: "Open full page: NiFe phase evolution",
    })
  ).toHaveCount(0)
  await expect(
    card.getByRole("button", { name: "Unlink NiFe phase evolution" })
  ).toBeVisible()
  expect(liveApiRequests).toEqual([])
})

test("confirms unlinking and preserves both resources", async ({ page }) => {
  await page.goto(`/hub/samples/${editableSample}?scenario=populated`)
  await page.waitForLoadState("networkidle")
  const card = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Relationships", { exact: true }) })
  await expect(
    card.getByRole("button", { name: "Unlink NiFe K-edge operando series" })
  ).toHaveCount(0)
  await card
    .getByRole("button", {
      name: "Manage relationships for NiFe oxide catalyst A",
    })
    .click()
  await card
    .getByRole("button", { name: "Unlink NiFe K-edge operando series" })
    .click()

  const dialog = page.getByRole("alertdialog", {
    name: "Unlink relationship?",
  })
  await expect(dialog).toContainText(
    "NiFe K-edge operando series will no longer be linked with NiFe oxide catalyst A."
  )
  await expect(dialog).toContainText("Neither resource will be deleted.")
  await dialog.getByRole("button", { name: "Unlink", exact: true }).click()

  await expect(dialog).toHaveCount(0)
  await expect(
    card.getByText("NiFe K-edge operando series", { exact: true })
  ).toHaveCount(0)
  await expect(card).toContainText("No immediate relationships are recorded.")
})

test("retains the selected relationship when creation fails", async ({
  page,
}) => {
  await page.goto(`/hub/datasets/${unlinkedDataset}?scenario=populated`)
  await page.waitForLoadState("networkidle")
  await page
    .getByRole("button", {
      name: "Add relationship to Activated catalyst morphology",
    })
    .click()

  const dialog = page.getByRole("dialog", { name: "Add relationship" })
  await dialog.getByLabel("Search datasets").fill("phase")
  await dialog.getByRole("button", { name: "Search", exact: true }).click()
  const result = dialog.getByRole("button", { name: /NiFe phase evolution/ })
  await result.click()
  let failed = false
  await page.route("**/hub/_serverFn/**", async (route) => {
    if (!failed && route.request().method() === "POST") {
      failed = true
      await route.abort("failed")
      return
    }
    await route.continue()
  })
  await dialog.getByRole("button", { name: "Add relationship" }).click()

  await expect(dialog.getByRole("alert")).toHaveText(
    "The relationship could not be added. Your selection is still here."
  )
  await expect(result).toHaveAttribute("aria-pressed", "true")
})

test("hides management when exact capabilities deny editing", async ({
  page,
}) => {
  await page.goto(`/hub/samples/${restrictedSample}?scenario=populated`)
  await page.waitForLoadState("networkidle")
  const card = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Relationships", { exact: true }) })

  await expect(
    card.getByRole("button", { name: /Add relationship to/ })
  ).toHaveCount(0)
  await expect(
    card.getByRole("button", { name: /Manage relationships for/ })
  ).toHaveCount(0)
  await expect(card.getByRole("button", { name: /^Unlink / })).toHaveCount(0)
})

test("keeps the compact add dialog accessible and contained", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/hub/datasets/${unlinkedDataset}?scenario=populated`)
  await page.waitForLoadState("networkidle")
  await page
    .getByRole("button", {
      name: "Add relationship to Activated catalyst morphology",
    })
    .click()

  const dialog = page.getByRole("dialog", { name: "Add relationship" })
  await expect(dialog).toBeVisible()
  const violations = await new AxeBuilder({ page }).analyze()
  expect(violations.violations).toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
})
