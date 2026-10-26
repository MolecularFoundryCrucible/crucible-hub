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
    await expect(page.locator('[data-mobile="true"]')).toHaveCount(0)

    await page.touchscreen.tap(370, 120)
    await expect(dialog).toHaveCount(0)
  })

  test("dims the page once for a dialog over the inspector", async ({
    page,
  }) => {
    await page.goto(
      "/hub/data?scenario=populated&preview=01J6Y8N4Q2R7M9K3T5V0W1X2Z7"
    )
    await page.waitForLoadState("networkidle")
    const inspector = page.locator('[data-slot="sheet-content"]')
    await inspector.getByRole("button", { name: /^Request deletion/ }).click()
    const overlay = page.locator('[data-slot="dialog-overlay"]')
    await expect(overlay).toHaveCount(1)
    await expect(overlay).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
    await expect(page.locator('[data-slot="sheet-overlay"]')).not.toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)"
    )
    expect(
      await inspector.evaluate(
        (sheet) => getComputedStyle(sheet, "::after").backgroundColor
      )
    ).not.toBe("rgba(0, 0, 0, 0)")

    await page.touchscreen.tap(195, 40)
    await expect(page.locator('[data-slot="dialog-content"]')).toHaveCount(0)
    await expect(inspector).toBeVisible()
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

  test("shortens project actions to icons", async ({ page }) => {
    await page.goto("/hub/projects/01J6Y8N4Q2R7M9K3T5V0W1X2Z3")
    await page.waitForLoadState("networkidle")
    const sections = page.getByRole("navigation", { name: "Project sections" })
    for (const name of ["Create sample", "Create dataset"]) {
      const link = page.getByRole("link", { name, exact: true })
      await expect(link).toBeVisible()
      expect(
        await link
          .getByText(name)
          .evaluate((label) => label.getBoundingClientRect().width)
      ).toBeLessThanOrEqual(1)
    }
    const refresh = page.getByRole("button", { name: /^Refresh details/ })
    await expect(refresh).toBeVisible()
    expect(
      await refresh
        .getByText("Refresh")
        .evaluate((label) => label.getBoundingClientRect().width)
    ).toBeLessThanOrEqual(1)
    await expect(sections).toBeVisible()
    await expect(
      page.getByLabel("Project data type").getByRole("button", {
        name: "Datasets",
      })
    ).toBeVisible()
    const filters = page.getByRole("button", { name: /^Filters/ })
    expect(
      await filters
        .getByText("Filters")
        .evaluate((label) => label.getBoundingClientRect().width)
    ).toBeLessThanOrEqual(1)

    await page.goto("/hub/datasets/01J6Y8N4Q2R7M9K3T5V0W1X2Z7")
    const browse = page.getByRole("button", {
      name: /^Change resource sequence/,
    })
    await expect(browse).toBeVisible()
    expect((await browse.boundingBox())!.width).toBeLessThanOrEqual(40)
    expect(
      await browse
        .getByText("Browse nearby")
        .evaluate((label) => label.getBoundingClientRect().width)
    ).toBeLessThanOrEqual(1)
  })

  test("shortens page header creation links to icons", async ({ page }) => {
    for (const [path, name, icon] of [
      ["/hub/projects", "Create project", '[data-resource-type="project"]'],
      [
        "/hub/instruments",
        "Register instrument",
        '[data-resource-type="instrument"]',
      ],
      ["/hub/admin/users", "Create user", '[data-resource-type="person"]'],
      [
        "/hub/admin/service-accounts",
        "Create service account",
        '[data-principal-type="service_account"]',
      ],
    ]) {
      if (path === "/hub/admin/users") {
        await openNavigation(page)
        await page.getByRole("switch", { name: "Administrator view" }).click()
        await expect(
          page.getByRole("switch", { name: "Administrator view" })
        ).toBeChecked()
      }
      await page.goto(path)
      await page.waitForLoadState("networkidle")
      const link = page.getByRole("link", { name, exact: true })
      await expect(link).toBeVisible()
      await expect(link.locator(icon)).toBeVisible()
      expect(
        await link
          .getByText(name)
          .evaluate((label) => label.getBoundingClientRect().width)
      ).toBeLessThanOrEqual(1)
    }
  })

  test("offers search types as a select", async ({ page }) => {
    await page.goto("/hub/search?q=catalyst")
    await page.waitForLoadState("networkidle")
    const select = page.getByRole("combobox", { name: "Resource type filter" })
    await expect(select).toBeVisible()
    await expect(
      page.getByRole("group", { name: "Resource type filter" })
    ).toBeHidden()
    await select.selectOption("project")
    await expect(page).toHaveURL(/kind=project/)
  })

  test("keeps page header actions beside the title", async ({ page }) => {
    await page.goto("/hub/data?scenario=populated")
    await page.waitForLoadState("networkidle")
    const title = (await page.getByRole("heading", { level: 1 }).boundingBox())!
    const create = (await page
      .getByRole("link", { name: "Create sample", exact: true })
      .boundingBox())!
    expect(create.x).toBeGreaterThan(title.x + title.width - 1)
  })

  test("drops the desktop collapse control from the drawer", async ({
    page,
  }) => {
    await openNavigation(page)
    await expect(
      page.getByRole("button", { name: "Collapse navigation" })
    ).toHaveCount(0)
  })

  test("gives the icon-only Create button the icon button border", async ({
    page,
  }) => {
    await page.goto("/hub/?scenario=populated")
    await page.waitForLoadState("networkidle")
    const border = await page
      .getByRole("button", { name: "Create" })
      .evaluate((button) => {
        const probe = document.createElement("div")
        probe.className = "border border-border-strong"
        document.body.append(probe)
        const expected = getComputedStyle(probe).borderTopColor
        probe.remove()
        return [getComputedStyle(button).borderTopColor, expected]
      })
    expect(border[0]).toBe(border[1])
  })

  test("sizes the Theme menu to its options", async ({ page }) => {
    await openNavigation(page)
    const trigger = (await page
      .getByRole("button", { name: "Theme" })
      .boundingBox())!
    await page.getByRole("button", { name: "Theme" }).click()
    const menu = (await page.getByRole("menu").boundingBox())!
    expect(menu.width).toBeLessThan(trigger.width)
  })

  test("keeps the drawer free of the desktop edge rail", async ({ page }) => {
    await page.setViewportSize({ height: 800, width: 700 })
    await openNavigation(page)
    await expect(page.locator('[data-sidebar="rail"]')).toBeHidden()
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

  test("dims the page for a dialog over the docked inspector", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: 1600 })
    await page.goto(
      "/hub/data?scenario=populated&preview=01J6Y8N4Q2R7M9K3T5V0W1X2Z7"
    )
    await page.waitForLoadState("networkidle")
    await page
      .locator('[data-slot="sheet-content"]')
      .getByRole("button", { name: /^Request deletion/ })
      .click()
    await expect(page.locator('[data-slot="dialog-overlay"]')).not.toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)"
    )
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
    await toast.evaluate((element) =>
      Promise.all(
        element.getAnimations().map((animation) => animation.finished)
      )
    )
    const box = (await toast.boundingBox())!
    const y = box.y + box.height / 2
    await page.mouse.move(box.x + 40, y)
    await page.mouse.down()
    await page.mouse.move(box.x + 300, y, { steps: 15 })
    await page.mouse.up()
    await expect(toast).toHaveCount(0)
  })
})
