import { expect, test as base } from "@playwright/test"

export const test = base.extend<{ runtimeErrors: void }>({
  runtimeErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      const recordError = (error: Error) => errors.push(error.message)
      page.on("pageerror", recordError)
      await use()
      if (!page.isClosed()) await page.waitForLoadState("load")
      page.off("pageerror", recordError)
      expect(errors, "Uncaught browser errors").toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
