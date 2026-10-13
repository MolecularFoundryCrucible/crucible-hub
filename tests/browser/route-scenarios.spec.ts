import { expect, test } from "../fixtures"

test("retains the selected scenario during workspace navigation", async ({
  page,
}) => {
  await page.goto("/hub/?scenario=empty")
  await page.getByRole("link", { exact: true, name: "Data" }).click()
  await expect(page).toHaveURL(/\/hub\/data\?scenario=empty$/)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Samples and datasets"
  )
})

test("keeps compact data records readable and fully actionable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto("/hub/data?scenario=populated")
  await page.waitForLoadState("networkidle")

  const resourceName = page.getByRole("link", {
    name: "Preview NiFe oxide catalyst A",
  })
  await expect(resourceName).toBeVisible()
  await expect(resourceName).toContainText("NiFe oxide catalyst A")
  await expect(
    page.getByRole("link", {
      name: "Open full page: NiFe oxide catalyst A",
    })
  ).toBeVisible()
  expect((await resourceName.boundingBox())?.width).toBeGreaterThan(150)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
})

test("previews on click and opens the full page on a modifier click", async ({
  context,
  page,
}) => {
  await page.goto("/hub/data?scenario=populated")
  await page.waitForLoadState("networkidle")
  const resourceName = page.getByRole("link", {
    name: "Preview NiFe oxide catalyst A",
  })
  const href = new URL(
    (await resourceName.getAttribute("href")) ?? "",
    page.url()
  ).pathname
  expect(href).toMatch(/^\/hub\/samples\/[^/?]+$/)

  const opened = context.waitForEvent("page")
  await resourceName.click({ modifiers: ["ControlOrMeta"] })
  const fullPage = await opened
  await fullPage.waitForURL(/\/hub\/samples\//)
  expect(new URL(fullPage.url()).pathname).toBe(href)
  await expect(page).toHaveURL(/\/hub\/data\?/)
  await expect(page).not.toHaveURL(/preview=/)
  await fullPage.close()

  await resourceName.click()
  await expect(page).toHaveURL(/\/hub\/data\?.*preview=/)
})

test("supports text spacing without horizontal page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto("/hub/data?scenario=dense")
  await page.addStyleTag({
    content: `
      * {
        letter-spacing: 0.12em !important;
        line-height: 1.5 !important;
        word-spacing: 0.16em !important;
      }
      p {
        margin-bottom: 2em !important;
      }
    `,
  })

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth
    )
  ).toBe(true)
})
