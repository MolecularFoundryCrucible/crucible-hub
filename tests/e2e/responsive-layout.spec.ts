import type { Page } from "@playwright/test"

import { expect, test } from "../fixtures"

const sample = "01J6Y8N4Q2R7M9K3T5V0W1X2Z5"

const sidebarState = (page: Page) =>
  page
    .locator('[data-slot="sidebar"][data-state]')
    .first()
    .getAttribute("data-state")

test("uses the icon rail and a modal inspector only at medium widths", async ({
  context,
  page,
}) => {
  await page.setViewportSize({ height: 800, width: 900 })
  await page.goto(`/hub/data?scenario=populated&preview=${sample}`)
  await page.waitForLoadState("networkidle")
  expect(await sidebarState(page)).toBe("collapsed")
  await expect(page.locator('[data-slot="sheet-overlay"]')).toBeVisible()
  const cookies = await context.cookies()
  expect(
    cookies.find((cookie) => cookie.name === "crucible_hub_window")?.value
  ).toBe("medium")

  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Expand navigation" }).click()
  expect(await sidebarState(page)).toBe("expanded")
  expect(
    (await context.cookies()).find(
      (cookie) => cookie.name === "crucible_hub_sidebar"
    )
  ).toBeUndefined()

  await page.setViewportSize({ height: 800, width: 1180 })
  await page.goto(`/hub/data?scenario=populated&preview=${sample}`)
  await page.waitForLoadState("networkidle")
  expect(await sidebarState(page)).toBe("expanded")
  await expect(page.locator('[data-slot="sheet-content"]')).toBeVisible()
  await expect(page.locator('[data-slot="sheet-overlay"]')).toHaveCount(0)
})
