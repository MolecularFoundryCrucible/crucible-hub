import { expect, test } from "../fixtures"
import { analyzeAccessibility } from "../accessibility"

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

    const results = await analyzeAccessibility(page)
    expect(results.violations).toEqual([])
  })
}
