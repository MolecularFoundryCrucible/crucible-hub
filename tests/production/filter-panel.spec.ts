import type { Page } from "@playwright/test"

import { expect, test } from "../fixtures"

const sheet = (page: Page) => page.locator('[data-slot="sheet-content"]')

test("groups filters into sections in one column, even on phones", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 })
  await page.goto("/hub/data?kind=datasets")
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: /^Filters/ }).click()

  for (const title of ["Scope", "Details", "Created"]) {
    await expect(sheet(page).getByText(title, { exact: true })).toBeVisible()
  }
  const lefts = await sheet(page)
    .locator('[data-slot="field"]:not([data-orientation="horizontal"])')
    .evaluateAll((fields) =>
      fields
        .filter((field) => !field.closest(".grid"))
        .map((field) => Math.round(field.getBoundingClientRect().left))
    )
  expect(new Set(lefts).size).toBe(1)
})

test("counts the draft's results on the apply button", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1280 })
  await page.goto("/hub/data?kind=datasets")
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: /^Filters/ }).click()

  const apply = sheet(page).getByRole("button", {
    name: /^Show \d+ datasets?$/,
  })
  await expect(apply).toHaveText("Show 3 datasets")
  await sheet(page).getByLabel("From").fill("2026-08-29")
  await expect(apply).toHaveText("Show 2 datasets")
  await sheet(page).getByLabel("From").fill("2026-12-31")
  await expect(
    sheet(page).getByRole("button", { name: "No matching datasets" })
  ).toBeDisabled()
})

test("searches facet values by typing and applies one", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1280 })
  await page.goto("/hub/data?kind=datasets")
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: /^Filters/ }).click()

  const measurement = sheet(page).getByRole("combobox", { name: "Measurement" })
  await measurement.click()
  await measurement.fill("diff")
  const options = page.getByRole("option")
  await expect(options).toHaveCount(1)
  await options.first().click()
  await expect(measurement).toHaveValue("X-ray diffraction")
  await sheet(page)
    .getByRole("button", { name: /^Show \d+ datasets?$/ })
    .click()

  await expect(
    page.getByRole("button", {
      name: "Remove filter: Measurement: X-ray diffraction",
    })
  ).toBeVisible()
})

test("shows a date range as one filter", async ({ page }) => {
  await page.goto(
    "/hub/data?kind=datasets&createdFrom=2026-08-01&createdTo=2026-08-31"
  )
  await page.waitForLoadState("networkidle")
  await expect(
    page.getByRole("button", {
      name: "Remove filter: Created: Aug 1, 2026 to Aug 31, 2026",
    })
  ).toBeVisible()
})

test("opens the panel from the hidden filters count", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1280 })
  await page.goto(
    "/hub/data?kind=datasets&visibility=private&affiliation=owner&createdFrom=2026-01-01&measurement=X-ray%20diffraction&measurementSet=true"
  )
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: /^Show all \d+ filters$/ }).click()
  await expect(sheet(page)).toBeVisible()
})

test("keeps the panel usable for an invalid link", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1280 })
  await page.goto("/hub/data?kind=samples&instrumentMfid=instrument-1")
  await page.waitForLoadState("networkidle")

  await expect(sheet(page)).toBeVisible()
  await expect(
    sheet(page).getByText(
      "Acquisition instrument filters apply only to datasets."
    )
  ).toBeVisible()
  await expect(
    sheet(page).getByRole("combobox", { name: "Owner" })
  ).toBeVisible()
  await sheet(page)
    .getByRole("button", { name: /^Show \d+ samples?$/ })
    .click()
  await expect(page).not.toHaveURL(/instrumentMfid/)
})

test("resets the draft without changing the applied filters", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1280 })
  await page.goto("/hub/data?kind=datasets&visibility=private")
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: /^Filters/ }).click()

  await sheet(page).getByRole("button", { name: "Reset" }).click()
  await expect(sheet(page)).toBeVisible()
  await expect(page).toHaveURL(/visibility=private/)
  await page.keyboard.press("Escape")
  await expect(
    page.getByRole("button", { name: "Remove filter: Visibility: Private" })
  ).toBeVisible()
})
