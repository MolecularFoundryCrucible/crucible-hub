import type { Page } from "@playwright/test"

import { expect, test } from "../fixtures"

const preview =
  "/hub/data?scenario=populated&preview=01J6Y8N4Q2R7M9K3T5V0W1X2Z7"

async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number }
) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Input.dispatchTouchEvent", {
    touchPoints: [from],
    type: "touchStart",
  })
  for (let step = 1; step <= 15; step++) {
    await cdp.send("Input.dispatchTouchEvent", {
      touchPoints: [
        {
          x: from.x + ((to.x - from.x) * step) / 15,
          y: from.y + ((to.y - from.y) * step) / 15,
        },
      ],
      type: "touchMove",
    })
    await page.waitForTimeout(16)
  }
  await cdp.send("Input.dispatchTouchEvent", {
    touchPoints: [],
    type: "touchEnd",
  })
  await page.waitForTimeout(400)
}

function inspectorBox(page: Page) {
  return page.evaluate(() => {
    const sheet = document.querySelector('[data-slot="sheet-content"]')!
    const body = sheet.querySelector(".resource-inspector-body")!
    const outer = sheet.getBoundingClientRect()
    const inner = body.getBoundingClientRect()
    return {
      bodyBottom: inner.bottom - 10,
      bodyTop: inner.top + 10,
      footer: outer.bottom - 20,
      x: inner.left + inner.width / 2,
    }
  })
}

/** A point on the page behind the inspector that is not a control. */
function blankPoint(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector("main")!.getBoundingClientRect()
    const sheet = document
      .querySelector('[data-slot="sheet-content"]')!
      .getBoundingClientRect()
    for (let y = main.top + 64; y < innerHeight - 40; y += 16)
      for (let x = main.left + 64; x < sheet.left - 16; x += 16) {
        const target = document.elementFromPoint(x, y)
        if (
          target?.closest("main") &&
          !target.closest(
            "a[href], button, input, select, textarea, [role='button'], [role='link'], [data-resource-preview-trigger]"
          )
        )
          return { x, y }
      }
    throw new Error("No blank point behind the inspector")
  })
}

const pageScroll = (page: Page) =>
  page.evaluate(() => document.scrollingElement!.scrollTop)

test.describe("touch on the inspector overlay", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { height: 500, width: 1180 },
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(preview)
    await page.waitForLoadState("networkidle")
    await expect(
      page.locator('[data-slot="sheet-content"] .resource-inspector-body')
    ).toBeVisible()
  })

  test("keeps the inspector open while the page behind scrolls", async ({
    page,
  }) => {
    const start = await blankPoint(page)
    await drag(page, start, { x: start.x, y: start.y - 300 })
    expect(await pageScroll(page)).toBeGreaterThan(0)
    await expect(page.locator('[data-slot="sheet-content"]')).toBeVisible()
    await expect(page).toHaveURL(/preview=/)
  })

  test("closes the inspector on a tap outside it", async ({ page }) => {
    const point = await blankPoint(page)
    await page.touchscreen.tap(point.x, point.y)
    await expect(page.locator('[data-slot="sheet-content"]')).toHaveCount(0)
  })

  test("does not scroll the page past the end of the inspector", async ({
    page,
  }) => {
    const box = await inspectorBox(page)
    await page.evaluate(() => {
      const body = document.querySelector(".resource-inspector-body")!
      body.scrollTop = body.scrollHeight
    })
    await drag(
      page,
      { x: box.x, y: box.bodyBottom },
      { x: box.x, y: box.bodyTop }
    )
    expect(await pageScroll(page)).toBe(0)

    await drag(
      page,
      { x: box.x, y: box.footer },
      { x: box.x, y: box.footer - 150 }
    )
    expect(await pageScroll(page)).toBe(0)
  })
})

test.describe("sidebar width", () => {
  for (const viewport of [
    { height: 800, width: 1024 },
    { height: 800, width: 390 },
  ]) {
    test(`does not scroll sideways at ${viewport.width}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await page.goto("/hub/?scenario=populated")
      await page.waitForLoadState("networkidle")
      if (viewport.width < 768)
        await page.getByRole("button", { name: "Expand navigation" }).click()
      const content = page.locator('[data-slot="sidebar-content"]').last()
      await expect(content).toBeVisible()
      expect(
        await content.evaluate(
          (element) => element.scrollWidth - element.clientWidth
        )
      ).toBe(0)
    })
  }
})
