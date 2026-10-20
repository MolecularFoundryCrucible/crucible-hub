import { expect, test } from "../fixtures"

for (const theme of ["light", "dark"] as const) {
  test(`documents the design system in the ${theme} fixture`, async ({
    page,
  }) => {
    await page.addInitScript((selectedTheme) => {
      localStorage.setItem("crucible-hub-theme", selectedTheme)
    }, theme)
    await page.goto("/hub/fixtures/design-system")

    for (const name of ["Palette", "Roles", "Actions", "Badges"]) {
      await expect(
        page.getByRole("heading", { level: 2, name, exact: true })
      ).toBeVisible()
    }
    for (const ramp of ["Neutral", "Brand blue", "Orange"]) {
      await expect(page.getByRole("list", { name: ramp })).toBeVisible()
    }
    for (const tier of ["Primary", "Secondary", "Tertiary"]) {
      await expect(page.getByRole("rowheader", { name: tier })).toBeVisible()
    }
    await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`))
  })
}
