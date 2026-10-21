import { expect, test } from "../fixtures"

const publicOnlyDataset = "Perovskite film absorption survey"
const publicOnlyMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2ZH"

test("hides public data from others until it is included", async ({ page }) => {
  await page.goto("/hub/data?kind=datasets")
  await page.waitForLoadState("networkidle")
  await expect(page.getByText("Activated catalyst morphology")).toBeVisible()
  await expect(page.getByText(publicOnlyDataset)).toHaveCount(0)

  await page.getByRole("button", { name: /^Filters/ }).click()
  await page.getByRole("checkbox", { name: "Include public data" }).click()
  await page.getByRole("button", { name: "Apply filters" }).click()

  await expect(page.getByText(publicOnlyDataset)).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Remove filter: Public" })
  ).toBeVisible()

  await page.getByRole("button", { name: "Remove filter: Public" }).click()
  await expect(page.getByText(publicOnlyDataset)).toHaveCount(0)
})

test("opens public data from others by direct link", async ({ page }) => {
  await page.goto(`/hub/datasets/${publicOnlyMfid}`)
  await expect(page.locator("main h1")).toHaveText(publicOnlyDataset)
})

test("offers public data when a search finds no samples or datasets", async ({
  page,
}) => {
  await page.goto("/hub/search?q=Perovskite")
  await page.waitForLoadState("networkidle")
  await expect(page.getByText(publicOnlyDataset)).toHaveCount(0)

  await page.getByRole("button", { name: "Include public data" }).click()

  await expect(page).toHaveURL(/publicData=include/)
  await expect(page.getByText(publicOnlyDataset)).toBeVisible()
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
  await expect(page.getByText(publicOnlyDataset)).toBeVisible()
})
