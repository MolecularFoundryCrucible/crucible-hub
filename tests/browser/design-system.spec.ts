import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "../fixtures"

const visualCases = [
  { name: "light-laptop", theme: "light", width: 1024, height: 768 },
  { name: "dark-laptop", theme: "dark", width: 1024, height: 768 },
  { name: "light-desktop", theme: "light", width: 1440, height: 900 },
  { name: "dark-desktop", theme: "dark", width: 1440, height: 900 },
  { name: "light-compact", theme: "light", width: 320, height: 900 },
  { name: "dark-compact", theme: "dark", width: 320, height: 900 },
] as const

for (const visualCase of visualCases) {
  test(`matches the ${visualCase.name} design baseline`, async ({ page }) => {
    await page.setViewportSize({
      width: visualCase.width,
      height: visualCase.height,
    })
    await page.emulateMedia({
      colorScheme: visualCase.theme,
      reducedMotion: "reduce",
    })
    await page.addInitScript((theme) => {
      localStorage.setItem("crucible-hub-theme", theme)
    }, visualCase.theme)
    await page.goto("/hub/fixtures/design-system")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Design system fixtures"
    )
    await expect(page.locator("select")).toHaveValue(visualCase.theme)

    await expect(page.getByTestId("design-system-fixture")).toHaveScreenshot(
      `${visualCase.name}.png`,
      { animations: "disabled", caret: "hide" }
    )
  })
}

test("keeps the fixture keyboard operable", async ({ page }) => {
  await page.goto("/hub/fixtures/design-system")

  await page.keyboard.press("Tab")
  await expect(page.locator("select")).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(
    page.getByRole("button", { name: "Primary action" })
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
