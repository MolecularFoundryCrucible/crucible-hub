import type { Page } from "@playwright/test"

import { expect, test } from "../fixtures"

test.use({ viewport: { height: 1000, width: 1600 } })

const pages = [
  "/hub/?scenario=populated",
  "/hub/data?scenario=populated",
  "/hub/projects",
  "/hub/projects/01J6Y8N4Q2R7M9K3T5V0W1X2Z3",
  "/hub/instruments",
  "/hub/instruments/01J6Y8N4Q2R7M9K3T5V0W1X2Z4",
  "/hub/datasets/01J6Y8N4Q2R7M9K3T5V0W1X2Z7",
  "/hub/samples/01J6Y8N4Q2R7M9K3T5V0W1X2Z5",
  "/hub/search?q=catalyst",
  "/hub/account?scenario=populated",
  "/hub/fixtures/design-system",
]

/** Visible, enabled controls whose cursor, or a descendant's, is not the pointer. */
function wrongCursors(page: Page) {
  return page.evaluate(() => {
    const controls = [
      "a[href]",
      "button",
      "select",
      "summary",
      '[role="button"]',
      '[role="checkbox"]',
      '[role="menuitem"]',
      '[role="menuitemcheckbox"]',
      '[role="menuitemradio"]',
      '[role="option"]',
      '[role="radio"]',
      '[role="switch"]',
      '[role="tab"]',
    ].join(",")
    const disabled = (element: Element) =>
      element.matches(':disabled, [aria-disabled="true"], [data-disabled]') ||
      element.closest("fieldset:disabled") !== null
    const visible = (element: Element) => {
      const box = element.getBoundingClientRect()
      return (
        box.width > 0 &&
        box.height > 0 &&
        getComputedStyle(element).visibility === "visible" &&
        getComputedStyle(element).pointerEvents !== "none"
      )
    }
    const describe = (element: Element) =>
      `${element.tagName.toLowerCase()}${
        element.getAttribute("role")
          ? `[role=${element.getAttribute("role")}]`
          : ""
      } "${(element.getAttribute("aria-label") ?? element.textContent)
        .trim()
        .slice(0, 40)}" cursor=${getComputedStyle(element).cursor}`

    const problems: string[] = []
    for (const control of document.querySelectorAll(controls)) {
      // The sidebar rail shows a resize cursor to signal it collapses the edge.
      if (control.matches('[data-sidebar="rail"]')) continue
      if (disabled(control) || !visible(control)) continue
      const targets = [control, ...control.querySelectorAll("*")].filter(
        (element) =>
          visible(element) &&
          (element === control ||
            !element.matches(`${controls},input,textarea`))
      )
      const wrong = targets.find(
        (element) => getComputedStyle(element).cursor !== "pointer"
      )
      if (wrong) problems.push(describe(wrong === control ? control : wrong))
    }
    return [...new Set(problems)]
  })
}

for (const path of pages) {
  test(`uses the pointer cursor on every control at ${path}`, async ({
    page,
  }) => {
    await page.goto(path)
    await page.waitForLoadState("networkidle")
    expect(await wrongCursors(page)).toEqual([])
  })
}

test("uses the pointer cursor on quick search results", async ({ page }) => {
  await page.goto("/hub/?scenario=populated")
  await page.waitForLoadState("networkidle")
  await page.getByRole("combobox", { name: /search/i }).fill("catalyst")
  await expect(page.getByRole("option").first()).toBeVisible()
  expect(await wrongCursors(page)).toEqual([])
})

test("uses the pointer cursor in the account menu", async ({ page }) => {
  await page.goto("/hub/?scenario=populated")
  await page.waitForLoadState("networkidle")
  await page
    .getByRole("button", { name: /account/i })
    .first()
    .click()
  await expect(page.getByRole("menuitem").first()).toBeVisible()
  expect(await wrongCursors(page)).toEqual([])
})
