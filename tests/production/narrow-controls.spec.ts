import type { Page } from "@playwright/test"

import { expect, test } from "../fixtures"

async function openNavigation(page: Page) {
  await page.goto("/hub/?scenario=populated")
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: "Expand navigation" }).click()
  await expect(page.locator('[data-mobile="true"]')).toBeVisible()
}

test.describe("phone", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { height: 800, width: 390 },
  })

  test("closes the shortcuts dialog on a tap outside it", async ({ page }) => {
    await openNavigation(page)
    await page.getByRole("button", { name: "Keyboard shortcuts" }).click()
    const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" })
    await expect(dialog).toBeVisible()

    await page.touchscreen.tap(370, 120)
    await expect(dialog).toHaveCount(0)
  })

  test("keeps the theme menu on screen", async ({ page }) => {
    await openNavigation(page)
    await page.getByRole("button", { name: "Theme" }).click()
    const menu = page.getByRole("menu")
    await expect(menu).toBeVisible()
    const box = (await menu.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(390)
    expect(box.y + box.height).toBeLessThanOrEqual(800)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBe(390)
  })

  test("leaves creation to the Create menu", async ({ page }) => {
    await page.goto("/hub/?scenario=populated")
    await page.waitForLoadState("networkidle")
    await expect(page.getByRole("button", { name: "Create" })).toBeVisible()
    await page.getByRole("button", { name: "Expand navigation" }).click()
    await expect(page.locator('[data-mobile="true"]')).toBeVisible()
    await expect(page.getByRole("link", { name: "Create sample" })).toBeHidden()
  })
})

test.describe("touch tablet", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { height: 1366, width: 1024 },
  })

  test("opens the navigation row where a hidden action used to be", async ({
    page,
  }) => {
    await page.goto("/hub/?scenario=populated")
    await page.waitForLoadState("networkidle")
    const row = (await page
      .getByRole("link", { name: "Browse samples" })
      .boundingBox())!
    await page.touchscreen.tap(row.x + row.width - 12, row.y + row.height / 2)
    await expect(page).toHaveURL(/\/hub\/data/)
  })
})

test.describe("mouse", () => {
  test.use({ viewport: { height: 800, width: 1280 } })

  test("reveals creation actions on hover", async ({ page }) => {
    await page.goto("/hub/?scenario=populated")
    await page.waitForLoadState("networkidle")
    const action = page.getByRole("link", { name: "Create sample" })
    await expect(action).toHaveCSS("opacity", "0")
    await page.getByRole("link", { name: "Browse samples" }).hover()
    await expect(action).toHaveCSS("opacity", "1")
  })

  test("closes the shortcuts dialog on a click outside it in a narrow window", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 800, width: 700 })
    await openNavigation(page)
    await page.getByRole("button", { name: "Keyboard shortcuts" }).click()
    const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" })
    await expect(dialog).toBeVisible()

    await page.mouse.click(650, 120)
    await expect(dialog).toHaveCount(0)
  })

  test("shows the deletion count darker than the light sidebar", async ({
    page,
  }) => {
    await page.goto("/hub/?scenario=populated")
    await page.waitForLoadState("networkidle")
    const lightness = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((element) => {
          const canvas = document.createElement("canvas")
          canvas.width = canvas.height = 1
          const context = canvas.getContext("2d", { willReadFrequently: true })!
          for (const surface of [element, ...element.querySelectorAll("*")]) {
            context.clearRect(0, 0, 1, 1)
            context.fillStyle = getComputedStyle(surface).backgroundColor
            context.fillRect(0, 0, 1, 1)
            const [r, g, b, alpha] = context.getImageData(0, 0, 1, 1).data
            if (alpha > 0) return 0.2126 * r + 0.7152 * g + 0.0722 * b
          }
          throw new Error("No painted surface")
        })
    const badge = await lightness('[data-sidebar="menu-badge"]')
    expect(badge).toBeLessThan(await lightness('[data-sidebar="sidebar"]'))
    expect(badge).toBeLessThan(
      await lightness('[data-sidebar="menu-button"][data-active]')
    )
  })

  test("dismisses a toast by swiping it sideways", async ({ page }) => {
    await page.goto("/hub/?scenario=populated")
    await page.waitForLoadState("networkidle")
    await page.getByRole("switch", { name: /administrator view/i }).click()
    const toast = page.locator('[data-slot="toast"]').first()
    await expect(toast).toBeVisible()
    const box = (await toast.boundingBox())!
    await page.mouse.move(box.x + 40, box.y + box.height / 2)
    await page.mouse.down()
    for (let step = 1; step <= 10; step++)
      await page.mouse.move(box.x + 40 + step * 25, box.y + box.height / 2)
    await page.mouse.up()
    await expect(toast).toHaveCount(0)
  })
})
