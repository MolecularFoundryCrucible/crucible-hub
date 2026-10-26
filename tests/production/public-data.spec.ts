import { expect, test } from "../fixtures"

const publicOnlyDataset = "Perovskite film absorption survey"
const publicOnlyMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2ZH"

test("hides public data from others until it is included", async ({ page }) => {
  await page.goto("/hub/data?kind=datasets")
  await page.waitForLoadState("networkidle")
  await expect(
    page.getByRole("main").getByText("Activated catalyst morphology")
  ).toBeVisible()
  await expect(page.getByRole("main").getByText(publicOnlyDataset)).toHaveCount(
    0
  )

  await page.getByRole("button", { name: /^Filters/ }).click()
  await page.getByRole("checkbox", { name: "Include public data" }).click()
  await page
    .getByRole("button", { name: /^(Apply filters|Show \d+ \w+)$/ })
    .click()

  await expect(
    page.getByRole("main").getByText(publicOnlyDataset)
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Remove filter: Public" })
  ).toBeVisible()

  await page.getByRole("button", { name: "Remove filter: Public" }).click()
  await expect(page.getByRole("main").getByText(publicOnlyDataset)).toHaveCount(
    0
  )
})

test("opens public data from others by direct link", async ({ page }) => {
  await page.goto(`/hub/datasets/${publicOnlyMfid}`)
  await expect(page.locator("main h1")).toHaveText(publicOnlyDataset)
})

test("includes public data from the search filters without a stray prompt", async ({
  page,
}) => {
  await page.goto("/hub/search?q=Novak")
  await page.waitForLoadState("networkidle")
  const main = page.getByRole("main")
  await expect(main.getByRole("heading", { name: "People" })).toBeVisible()
  await expect(
    main.getByRole("button", { name: "Include public data" })
  ).toHaveCount(0)

  await page.getByRole("button", { name: /^Filters/ }).click()
  await page.getByRole("checkbox", { name: "Include public data" }).click()
  await page
    .getByRole("button", { name: /^(Apply filters|Show \d+ \w+)$/ })
    .click()

  await expect(page).toHaveURL(/publicData=include/)
  await expect(
    page.getByRole("button", { name: "Remove filter: Public" })
  ).toBeVisible()
})

test("offers public data when a search finds nothing", async ({ page }) => {
  await page.goto("/hub/search?q=Perovskite")
  await page.waitForLoadState("networkidle")
  const main = page.getByRole("main")
  await expect(main.getByText("No matches for “Perovskite”")).toBeVisible()

  await main.getByRole("button", { name: "Include public data" }).click()

  await expect(page).toHaveURL(/publicData=include/)
  await expect(main.getByText(publicOnlyDataset)).toBeVisible()
})

test("limits search to resources the viewer owns", async ({ page }) => {
  await page.goto("/hub/search?q=catalyst")
  await page.waitForLoadState("networkidle")
  const main = page.getByRole("main")

  await page.getByRole("button", { name: /^Filters/ }).click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Owned by me" })
    .click()
  await expect(
    page.getByRole("checkbox", { name: "Include public data" })
  ).toBeDisabled()
  await page
    .getByRole("button", { name: /^(Apply filters|Show \d+ \w+)$/ })
    .click()

  await expect(page).toHaveURL(/affiliation=owner/)
  await expect(
    page.getByRole("button", { name: "Remove filter: Ownership: Owned by me" })
  ).toBeVisible()
  await expect(main.getByRole("heading", { name: "People" })).toHaveCount(0)
})

test("sends quick search to the search page with public data included", async ({
  page,
}) => {
  await page.goto("/hub/")
  await page.waitForLoadState("networkidle")
  const search = page.getByRole("combobox", { name: /search/i }).first()
  await search.click()
  await search.fill("Perovskite")

  await page.getByRole("button", { name: "Include public data" }).click()

  await expect(page).toHaveURL(/\/hub\/search\?.*publicData=include/)
  await expect(
    page.getByRole("main").getByText(publicOnlyDataset)
  ).toBeVisible()
})
