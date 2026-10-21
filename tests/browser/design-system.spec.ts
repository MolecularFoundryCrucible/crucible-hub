import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "../fixtures"

test("keeps the fixture keyboard operable", async ({ page }) => {
  await page.goto("/hub/fixtures/design-system")

  await page.keyboard.press("Tab")
  await expect(page.getByRole("combobox", { name: "Theme" })).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(
    page.getByRole("button", { name: "Primary action" }).first()
  ).toBeFocused()
})

test("respects reduced motion and compact reflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/hub/fixtures/design-system")

  await expect(page.getByTestId("design-system-fixture")).toBeVisible()
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth
    )
  ).toBe(true)
  await expect(page.locator('[data-slot="skeleton"]').first()).toHaveCSS(
    "animation-iteration-count",
    "1"
  )
})

for (const theme of ["light", "dark"] as const) {
  test(`has no detectable ${theme} fixture accessibility violations`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.addInitScript((selectedTheme) => {
      localStorage.setItem("crucible-hub-theme", selectedTheme)
    }, theme)
    await page.goto("/hub/fixtures/design-system")
    await page.waitForLoadState("networkidle")

    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })
}
