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

test("shows a hint while the pane is empty", async ({ page }) => {
  await page.goto("/hub/data?scenario=populated")
  await page.waitForLoadState("networkidle")
  const hint = page.getByText("Preview items show here")
  await expect(hint).toBeVisible()

  await page
    .getByRole("link", { name: "Preview NiFe oxide catalyst A" })
    .click()
  await expect(
    pane(page).getByRole("heading", { name: "NiFe oxide catalyst A" })
  ).toBeVisible()
  await expect(hint).toHaveCount(0)
})

test("slides the preview out with the pane and brings it back", async ({
  page,
}) => {
  await page.goto("/hub/data?scenario=populated")
  await page.waitForLoadState("networkidle")
  await page
    .getByRole("link", { name: "Preview NiFe oxide catalyst A" })
    .click()
  await expect(
    pane(page).getByRole("heading", { name: "NiFe oxide catalyst A" })
  ).toBeVisible()
  await page.evaluate(() => {
    const frames: { content: number; float: boolean; sheet: number }[] = []
    Object.assign(window, { paneFrames: frames })
    const inset = document.querySelector('[data-slot="sidebar-inset"]')!
    const watch = () => {
      const sheet = document.querySelector('[data-slot="sheet-content"]')
      if (!sheet?.hasAttribute("data-pane-motion")) {
        if (!sheet) return
        requestAnimationFrame(watch)
        return
      }
      frames.push({
        content: innerWidth - parseFloat(getComputedStyle(inset).paddingRight),
        float: !sheet.hasAttribute("data-docked"),
        sheet: sheet.getBoundingClientRect().left,
      })
      requestAnimationFrame(watch)
    }
    requestAnimationFrame(watch)
  })

  await page.getByRole("button", { name: "Hide preview panel" }).click()
  await expect(pane(page)).toHaveCount(0)
  await expect(page).not.toHaveURL(/preview=/)
  const frames = await page.evaluate(
    () =>
      (
        window as unknown as {
          paneFrames: { content: number; float: boolean; sheet: number }[]
        }
      ).paneFrames
  )
  expect(frames.some((frame) => frame.float)).toBe(false)
  const edges = frames.map((frame) => frame.content)
  const moving = frames.filter(
    (frame) =>
      frame.content > Math.min(...edges) && frame.content < Math.max(...edges)
  )
  expect(moving.length).toBeGreaterThan(0)
  for (const frame of moving)
    expect(Math.abs(frame.sheet - frame.content)).toBeLessThan(2)

  await page.getByRole("button", { name: "Show preview panel" }).click()
  await expect(
    pane(page).getByRole("heading", { name: "NiFe oxide catalyst A" })
  ).toBeVisible()
})

test("keeps the remembered preview and its trail when hidden", async ({
  page,
}) => {
  await page.goto("/hub/data?scenario=populated")
  await page.waitForLoadState("networkidle")
  await page
    .getByRole("link", { name: "Preview NiFe oxide catalyst A" })
    .click()
  await pane(page)
    .getByRole("link", { name: "NiFe K-edge operando series" })
    .first()
    .click()
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Projects", exact: true })
    .first()
    .click()
  await expect(page).toHaveURL(/\/hub\/projects/)
  await expect(
    pane(page).getByRole("heading", { name: "NiFe K-edge operando series" })
  ).toBeVisible()

  await page.getByRole("button", { name: "Hide preview panel" }).click()
  await expect(pane(page)).toHaveCount(0)
  await expect(page.getByText("Preview items show here")).toHaveCount(0)
  await page.getByRole("button", { name: "Show preview panel" }).click()
  await pane(page).getByRole("link", { name: "Back" }).click()
  await expect(
    pane(page).getByRole("heading", { name: "NiFe oxide catalyst A" })
  ).toBeVisible()
})

test("empties the pane when the preview is closed", async ({ page }) => {
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

  await pane(page).getByRole("button", { name: "Close" }).click()
  await expect(pane(page)).toHaveCount(0)
  await expect(page).not.toHaveURL(/preview=/)
  await expect(page.getByText("Preview items show here")).toBeVisible()
})

test("styles both panel toggles the same", async ({ page }) => {
  const look = (name: string) =>
    page.getByRole("button", { name }).evaluate((element) => {
      const style = getComputedStyle(element)
      return [
        style.width,
        style.height,
        style.backgroundColor,
        style.borderWidth,
        style.borderRadius,
        style.boxShadow,
        style.color,
      ]
    })

  await page.goto("/hub/?scenario=populated")
  await page.waitForLoadState("networkidle")
  const paneToggle = await look("Hide preview panel")

  await page.setViewportSize({ height: 800, width: 390 })
  await expect(
    page.getByRole("button", { name: "Expand navigation" })
  ).toBeVisible()
  expect(await look("Expand navigation")).toEqual(paneToggle)
})
