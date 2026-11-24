import { expect, test } from "../fixtures"

test.describe("phone", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { height: 800, width: 390 },
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
