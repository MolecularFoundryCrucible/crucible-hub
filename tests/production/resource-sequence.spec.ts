import { expect, test } from "../fixtures"

const dataset = "/hub/datasets/01J6Y8N4Q2R7M9K3T5V0W1X2Z7"
const sequenceButton = /^Change resource sequence/

test("applies the default neighbour sequence without the dialog", async ({
  page,
}) => {
  await page.goto(dataset)
  await expect(
    page.getByRole("button", { name: sequenceButton })
  ).toContainText("in this project · Created oldest")
  await expect(
    page.getByRole("navigation", { name: "Resource sequence navigation" })
  ).toBeVisible()
})

test("steps through the default sequence and keeps it", async ({ page }) => {
  await page.goto("/hub/samples/01J6Y8N4Q2R7M9K3T5V0W1X2Z5")
  const trigger = page.getByRole("button", { name: sequenceButton })
  await expect(trigger).toContainText("in this project")
  const label = await trigger.textContent()

  await page.keyboard.press("ArrowRight")
  await expect(page).toHaveURL(/samples\/01J6Y8N4Q2R7M9K3T5V0W1X2Z6/)
  await expect(trigger).toHaveText(label!)

  await page.getByRole("button", { name: /^Previous item/ }).click()
  await expect(page).toHaveURL(/samples\/01J6Y8N4Q2R7M9K3T5V0W1X2Z5/)
  await expect(trigger).toHaveText(label!)
})

test("keeps a cleared sequence cleared on that page", async ({ page }) => {
  await page.goto(dataset)
  const trigger = page.getByRole("button", { name: sequenceButton })
  await expect(trigger).toContainText("in this project")
  await trigger.click()
  await page.getByRole("button", { name: "Clear sequence" }).click()
  await expect(trigger).toContainText("Browse nearby")
  await expect(
    page.getByRole("navigation", { name: "Resource sequence navigation" })
  ).toHaveCount(0)
})

test("links to each preferences tab and shows only its settings", async ({
  page,
}) => {
  await page.goto("/hub/preferences")
  const main = page.getByRole("main")
  const tabs = page.getByRole("navigation", { name: "Preference sections" })
  await expect(tabs.getByRole("link", { name: "General" })).toHaveAttribute(
    "aria-current",
    "page"
  )
  await expect(main.getByText("Theme", { exact: true })).toBeVisible()
  await expect(main.getByText("Group samples by")).toHaveCount(0)

  await tabs.getByRole("link", { name: "History" }).click()
  await expect(page).toHaveURL(/tab=history/)
  await expect(
    main.getByRole("button", { name: "Clear history" })
  ).toBeVisible()
  await expect(main.getByText("Theme", { exact: true })).toHaveCount(0)

  await page.goto("/hub/preferences?tab=browsing")
  await expect(main.getByText("Group samples by")).toBeVisible()
  await expect(main.getByText("Nearby samples")).toBeVisible()
})
