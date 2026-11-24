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

test.use({
  hasTouch: true,
  isMobile: true,
  viewport: { height: 500, width: 1180 },
})

test("keeps the inspector open while the page behind scrolls and closes it on a tap outside", async ({
  page,
}) => {
  await page.goto(preview)
  await page.waitForLoadState("networkidle")
  await expect(
    page.locator('[data-slot="sheet-content"] .resource-inspector-body')
  ).toBeVisible()

  const start = await blankPoint(page)
  await drag(page, start, { x: start.x, y: start.y - 300 })
  expect(await pageScroll(page)).toBeGreaterThan(0)
  await expect(page.locator('[data-slot="sheet-content"]')).toBeVisible()
  await expect(page).toHaveURL(/preview=/)

  const point = await blankPoint(page)
  await page.touchscreen.tap(point.x, point.y)
  await expect(page.locator('[data-slot="sheet-content"]')).toHaveCount(0)
})
