import type { Page } from "@playwright/test"

import { expect, test } from "../fixtures"

test.use({ viewport: { height: 1000, width: 1600 } })

function contentWidth(page: Page) {
  return page.evaluate(() => {
    const inset = document.querySelector('[data-slot="sidebar-inset"]')!
    return Math.round(
      inset.getBoundingClientRect().width -
        parseFloat(getComputedStyle(inset).paddingRight)
    )
  })
}

const pane = (page: Page) => page.locator('[data-slot="sheet-content"]')

test("keeps the preview pane and the layout steady while navigating", async ({
  page,
}) => {
  await page.goto("/hub/data?scenario=populated")
  await page.waitForLoadState("networkidle")
  const width = await contentWidth(page)

  await page
    .getByRole("link", { name: "Preview NiFe oxide catalyst A" })
    .click()
  await expect(
    pane(page).getByRole("heading", { name: "NiFe oxide catalyst A" })
  ).toBeVisible()
  expect(await contentWidth(page)).toBe(width)

  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Projects", exact: true })
    .first()
    .click()
  await expect(page).toHaveURL(/\/hub\/projects/)
  await expect(
    pane(page).getByRole("heading", { name: "NiFe oxide catalyst A" })
  ).toBeVisible()
  expect(await contentWidth(page)).toBe(width)
  expect(
    await pane(page).evaluate((element) =>
      element.contains(document.activeElement)
    )
  ).toBe(false)

  await pane(page).getByRole("button", { name: "Close" }).click()
  await expect(pane(page)).toHaveCount(0)
  expect(await contentWidth(page)).toBe(width)
})

test("hides and shows the preview pane", async ({ page }) => {
  await page.goto("/hub/data?scenario=populated")
  await page.waitForLoadState("networkidle")
  const shown = await contentWidth(page)

  await page.getByRole("button", { name: "Hide preview panel" }).click()
  await expect.poll(() => contentWidth(page)).toBeGreaterThan(shown)

  await page.getByRole("button", { name: "Show preview panel" }).click()
  await expect.poll(() => contentWidth(page)).toBe(shown)
})

test("keeps the Back trail when leaving the page", async ({ page }) => {
  await page.goto("/hub/data?scenario=populated")
  await page.waitForLoadState("networkidle")
  await page
    .getByRole("link", { name: "Preview NiFe oxide catalyst A" })
    .click()
  await pane(page)
    .getByRole("link", { name: "NiFe K-edge operando series" })
    .first()
    .click()
  await expect(
    pane(page).getByRole("heading", { name: "NiFe K-edge operando series" })
  ).toBeVisible()

  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Projects", exact: true })
    .first()
    .click()
  await expect(page).toHaveURL(/\/hub\/projects/)
  await pane(page).getByRole("link", { name: "Back" }).click()
  await expect(
    pane(page).getByRole("heading", { name: "NiFe oxide catalyst A" })
  ).toBeVisible()
})

test("floats previews over the page while the pane is hidden", async ({
  page,
}) => {
  await page.goto("/hub/data?scenario=populated")
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: "Hide preview panel" }).click()
  await expect(page.locator('[data-slot="sidebar-inset"]')).toHaveCSS(
    "padding-right",
    "0px"
  )
  const width = await contentWidth(page)

  await page
    .getByRole("link", { name: "Preview NiFe oxide catalyst A" })
    .click()
  await expect(
    pane(page).getByRole("heading", { name: "NiFe oxide catalyst A" })
  ).toBeVisible()
  expect(await contentWidth(page)).toBe(width)
  await expect(
    page.getByRole("button", { name: "Show preview panel" })
  ).toBeVisible()

  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Projects", exact: true })
    .first()
    .click()
  await expect(page).toHaveURL(/\/hub\/projects/)
  await expect(pane(page)).toHaveCount(0)
})
