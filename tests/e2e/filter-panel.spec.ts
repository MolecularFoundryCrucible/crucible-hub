import type { Page } from "@playwright/test"

import { expect, test } from "../fixtures"

const sheet = (page: Page) => page.locator('[data-slot="sheet-content"]')

test("counts the draft's results, then applies a searched facet value", async ({
  page,
}) => {
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
  await expect(apply).toHaveText("Show 0 datasets")
  await expect(apply).toBeEnabled()
  await page.keyboard.press("Escape")
  await expect(sheet(page)).toHaveCount(0)
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
