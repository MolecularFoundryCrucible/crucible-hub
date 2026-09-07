import AxeBuilder from "@axe-core/playwright"

import { expect, test } from "../fixtures"

const sampleMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z5"
const datasetMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z7"

test("explores immediate resource relationships without replacing the Hub shell", async ({
  page,
}) => {
  const liveApiRequests: string[] = []
  const graphWarnings: string[] = []
  page.on("request", (request) => {
    if (/crucible\.lbl\.gov|testapi|staging/i.test(request.url())) {
      liveApiRequests.push(request.url())
    }
  })
  page.on("console", (message) => {
    if (
      message.type() === "warning" &&
      /style property|wheelSensitivity/i.test(message.text())
    ) {
      graphWarnings.push(message.text())
    }
  })

  await page.goto(`/hub/samples/${sampleMfid}?scenario=populated`)
  await page.waitForLoadState("networkidle")
  const heading = page.getByRole("heading", {
    level: 1,
    name: "NiFe oxide catalyst A",
  })
  await page
    .getByRole("link", { name: "Explore graph for NiFe oxide catalyst A" })
    .click()

  await expect(page).toHaveURL(new RegExp(`/hub/samples/${sampleMfid}/graph`))
  await expect(heading).toBeVisible()
  await expect(
    page
      .getByRole("navigation", { name: "Sample sections" })
      .getByRole("link", { name: "Graph" })
  ).toHaveAttribute("aria-current", "page")
  await expect(
    page.getByRole("img", { name: /Graph of 2 resources/ })
  ).toBeVisible()
  await expect(page.getByText("2 resources", { exact: true })).toBeVisible()
  await expect(page.getByText("1 relationship", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Theme" }).click()
  await page.getByRole("menuitemradio", { name: "Dark" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)

  await page
    .getByRole("link", { name: "NiFe K-edge operando series", exact: true })
    .click()
  const inspector = page.getByRole("dialog")
  await expect(
    inspector.getByRole("heading", { name: "NiFe K-edge operando series" })
  ).toBeVisible()
  await expect(page).toHaveURL(
    new RegExp(`/samples/${sampleMfid}/graph.*preview=${datasetMfid}`)
  )
  await inspector.getByRole("link", { name: "Explore from here" }).click()

  await expect(page).toHaveURL(new RegExp(`/hub/datasets/${datasetMfid}/graph`))
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "NiFe K-edge operando series",
    })
  ).toBeVisible()
  await expect(inspector).toHaveCount(0)
  expect(liveApiRequests).toEqual([])
  expect(graphWarnings).toEqual([])
})

test("keeps the graph alternative accessible on a compact viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/hub/datasets/${datasetMfid}/graph?scenario=populated`)
  await page.waitForLoadState("networkidle")

  await expect(
    page.getByRole("img", { name: /Graph of 2 resources/ })
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "NiFe oxide catalyst A", exact: true })
  ).toBeVisible()
  const accessibilityResults = await new AxeBuilder({ page }).analyze()
  expect(accessibilityResults.violations).toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
})
