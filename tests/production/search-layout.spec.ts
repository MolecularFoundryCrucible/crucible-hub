import { expect, test } from "../fixtures"

for (const { width, popupWidth } of [
  { width: 360, popupWidth: 328 },
  { width: 768, popupWidth: 448 },
]) {
  test(`aligns quick search results with the search field at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto("/hub/")
    await page.waitForLoadState("networkidle")
    const search = page.getByRole("combobox", { name: /search/i }).first()
    await search.click()
    await search.fill("Perovskite")

    const viewAll = page.getByRole("button", {
      name: "View all results for “Perovskite”",
    })
    await expect(viewAll).toBeVisible()
    const content = page.locator("[data-slot=combobox-content]")
    await content.evaluate((element) =>
      Promise.all(
        element.getAnimations().map((animation) => animation.finished)
      )
    )
    const field = (await page.getByRole("search").boundingBox())!
    const popup = (await content.boundingBox())!

    expect(Math.round(popup.width)).toBe(popupWidth)
    expect(Math.round(popup.x)).toBe(width < 640 ? 16 : Math.round(field.x))
    expect((await viewAll.boundingBox())!.width).toBeGreaterThan(
      popupWidth - 16
    )
  })
}
