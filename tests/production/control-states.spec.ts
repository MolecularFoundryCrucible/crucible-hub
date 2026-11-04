import type { Locator } from "@playwright/test"

import { expect, test } from "../fixtures"

function markerStyle(element: Locator) {
  return element.evaluate((node) => {
    const { backgroundColor, left, width } = getComputedStyle(node, "::before")
    return { backgroundColor, left, width }
  })
}

for (const theme of ["light", "dark"]) {
  test(`uses one selection marker in the ${theme} theme`, async ({
    context,
    page,
  }) => {
    await context.addCookies([
      {
        name: "crucible_hub_theme",
        url: "http://127.0.0.1:4174",
        value: theme,
      },
    ])
    await page.goto("/hub/data?kind=datasets&view=grouped&groupBy=measurement")
    await page.waitForLoadState("networkidle")
    await page.locator(".group-directory-columns").nth(1).click()
    const group = page.locator('.group-directory-columns[aria-current="page"]')
    const navigation = page.locator(
      '[data-slot="sidebar-menu-button"][data-active]'
    )
    await expect(group).toBeVisible()
    const groupMarker = await markerStyle(group)
    expect(groupMarker.width).toBe("2px")
    expect(groupMarker).toEqual(await markerStyle(navigation.first()))
  })
}

test("shows the selected group with more than color", async ({ page }) => {
  await page.goto("/hub/data?kind=datasets&view=grouped&groupBy=measurement")
  await page.waitForLoadState("networkidle")
  await page.locator(".group-directory-columns").nth(1).click()
  const selected = page.locator(
    'nav .group-directory-columns[aria-current="page"]'
  )
  await expect(selected).toBeVisible()
  const nameWeight = (row: Locator) =>
    row
      .locator("span")
      .first()
      .evaluate((node) => Number(getComputedStyle(node).fontWeight))
  const other = page
    .locator("nav .group-directory-columns:not([aria-current])")
    .first()
  expect(await nameWeight(selected)).toBeGreaterThan(await nameWeight(other))
})
