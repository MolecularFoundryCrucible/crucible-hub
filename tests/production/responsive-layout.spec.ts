import type { Page } from "@playwright/test"

import { expect, test } from "../fixtures"

const dataset = "/hub/datasets/01J6Y8N4Q2R7M9K3T5V0W1X2Z7"
const project = "/hub/projects/01J6Y8N4Q2R7M9K3T5V0W1X2Z3"

/** Whether any child of the element starts below another child's bottom. */
function wraps(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const boxes = [...element.children]
        .map((child) => child.getBoundingClientRect())
        .filter((box) => box.width > 1)
      return boxes.some((a) => boxes.some((b) => a.top >= b.bottom - 1))
    })
}

const sectionRow = 'nav[aria-label$="sections"] >> xpath=..'

for (const width of [900, 1024, 1440]) {
  test(`keeps section actions beside the tabs at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width })
    for (const path of [project, dataset]) {
      await page.goto(path)
      await page.waitForLoadState("networkidle")
      expect(await wraps(page, sectionRow)).toBe(false)
    }
    await page.goto("/hub/data?scenario=populated")
    await page.waitForLoadState("networkidle")
    expect(await wraps(page, "main header")).toBe(false)
  })
}

test("lays the overview out by content width, not window width", async ({
  page,
}) => {
  const columns = () =>
    page
      .locator('main [data-slot="card"]')
      .evaluateAll(
        (cards) =>
          new Set(cards.map((card) => card.getBoundingClientRect().left)).size
      )

  await page.setViewportSize({ height: 900, width: 1280 })
  await page.goto(dataset)
  await page.waitForLoadState("networkidle")
  expect(await columns()).toBe(2)

  await page.setViewportSize({ height: 900, width: 1440 })
  await expect.poll(columns).toBe(1)
})

test("truncates each breadcrumb segment and keeps room for the page", async ({
  page,
}) => {
  await page.setViewportSize({ height: 800, width: 390 })
  await page.goto(dataset)
  await page.waitForLoadState("networkidle")
  const long =
    "Operando Catalyst Mapping of Nickel Iron Oxide Electrocatalysts Under Alkaline Oxygen Evolution Conditions"
  const widths = await page.evaluate((name) => {
    const items = [
      ...document.querySelectorAll('[data-slot="breadcrumb-item"]'),
    ]
    items[1].querySelector("a")!.textContent = name
    return items.map((item) => item.getBoundingClientRect().width)
  }, long)
  const [root, ancestor, current] = widths
  expect(root).toBeGreaterThan(40)
  expect(ancestor).toBeGreaterThan(60)
  expect(current).toBeGreaterThan(ancestor)
  await expect(page.locator('[data-slot="breadcrumb-page"]')).toHaveAttribute(
    "title",
    "NiFe K-edge operando series"
  )
})
