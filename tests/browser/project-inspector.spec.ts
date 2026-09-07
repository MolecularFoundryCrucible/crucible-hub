import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"

import { expect, test } from "../fixtures"

const projectMfid = "fixture-project-1"
const projectPath = `/hub/projects/${projectMfid}`
const sharedProjectUrl = `${projectPath}?scenario=dense&scope=shared`
const sampleOne = "fixture-sample-1"
const sampleTwo = "fixture-sample-2"
const datasetTwo = "fixture-dataset-2"

function isResourceRequest(url: string, resourceMfid?: string) {
  const decoded = decodeURIComponent(url)
  return (
    url.includes("/hub/_serverFn/") &&
    decoded.includes("resourceMfid") &&
    (!resourceMfid || decoded.includes(resourceMfid))
  )
}

function isProjectDataRequest(url: string) {
  const decoded = decodeURIComponent(url)
  return (
    url.includes("/hub/_serverFn/") &&
    decoded.includes("projectMfid") &&
    decoded.includes("projectScope")
  )
}

function isDatasetFilesRequest(url: string) {
  const decoded = decodeURIComponent(url)
  return url.includes("/hub/_serverFn/") && decoded.includes("datasetMfid")
}

function sampleRow(page: Page, name: string) {
  return page.getByRole("row").filter({
    has: page.getByRole("link", { name: `Preview ${name}`, exact: true }),
  })
}

test("project preview preserves the collection and restores trigger focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(sharedProjectUrl)
  await page.waitForLoadState("networkidle")

  const heading = page.locator("main h1")
  const table = page.locator('[data-slot="table-container"]')
  const headingBefore = await heading.boundingBox()
  const tableBefore = await table.boundingBox()
  const scrollBefore = await page.evaluate(() => ({ x: scrollX, y: scrollY }))
  const trigger = sampleRow(page, "Catalyst sample 2").getByRole("link", {
    name: "Preview Catalyst sample 2",
    exact: true,
  })
  const openHeader = page.getByRole("columnheader", {
    name: "Open",
    exact: true,
  })
  await expect(openHeader).toBeVisible()
  await expect(openHeader.getByText("Open", { exact: true })).toHaveClass(
    /sr-only/
  )
  const projectResponses: string[] = []
  const resourceResponses: string[] = []
  const fileResponses: string[] = []
  page.on("response", (response) => {
    if (!response.ok()) return
    const url = response.url()
    if (isProjectDataRequest(url)) projectResponses.push(url)
    if (isResourceRequest(url)) resourceResponses.push(url)
    if (isDatasetFilesRequest(url)) fileResponses.push(url)
  })

  await trigger.click()
  const panel = page.getByRole("dialog")
  await expect(
    panel.getByRole("heading", { name: "Catalyst sample 2" })
  ).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`preview=${sampleTwo}`))
  expect(await heading.boundingBox()).toEqual(headingBefore)
  expect(await table.boundingBox()).toEqual(tableBefore)
  expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual(
    scrollBefore
  )
  await expect(
    page.getByLabel("Project data type").locator('[aria-current="page"]')
  ).toHaveText("Samples")
  await expect(page.locator("#project-data-relationship")).toHaveValue("shared")
  await expect
    .poll(
      () =>
        resourceResponses.filter((url) => isResourceRequest(url, sampleTwo))
          .length
    )
    .toBe(1)
  expect(resourceResponses).toHaveLength(1)
  expect(projectResponses).toHaveLength(0)
  expect(fileResponses).toHaveLength(0)

  await page.keyboard.press("Escape")
  await expect(panel).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await trigger.click()
  await expect(panel).toBeVisible()
  await page
    .locator('[data-slot="sheet-overlay"]')
    .click({ position: { x: 1, y: 1 } })
  await expect(panel).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test("project preview follows links, history, and full-page promotion", async ({
  page,
}) => {
  await page.goto(sharedProjectUrl)
  await page.waitForLoadState("networkidle")
  const trigger = sampleRow(page, "Catalyst sample 2").getByRole("link", {
    name: "Preview Catalyst sample 2",
    exact: true,
  })
  const direct = sampleRow(page, "Catalyst sample 2").getByRole("link", {
    name: "Open full page: Catalyst sample 2",
    exact: true,
  })
  await expect(direct.locator(".resource-full-page-link-label")).toBeHidden()
  await direct.click()
  await expect(page).toHaveURL(
    new RegExp(`/hub/samples/${sampleTwo}\\?scenario=dense`)
  )
  await page.goBack()
  await expect(page).toHaveURL(sharedProjectUrl)
  await trigger.click()
  const panel = page.getByRole("dialog")
  await expect(
    panel.getByRole("heading", { name: "Catalyst sample 2" })
  ).toBeVisible()
  const canonicalNeighbour = panel.getByRole("link", {
    name: "Open full page: Nickel iron oxide catalyst",
  })
  const canonicalNeighbourUrl = new URL(
    (await canonicalNeighbour.getAttribute("href")) ?? "",
    page.url()
  )
  expect(canonicalNeighbourUrl.pathname).toBe(`/hub/samples/${sampleOne}`)
  for (const searchKey of [
    "datasetCursor",
    "kind",
    "preview",
    "sampleCursor",
    "scope",
  ]) {
    expect(canonicalNeighbourUrl.searchParams.has(searchKey)).toBe(false)
  }
  await panel
    .getByRole("link", { name: "Preview Nickel iron oxide catalyst" })
    .click()
  await expect(page).toHaveURL(new RegExp(`preview=${sampleOne}`))
  await expect(
    panel.getByRole("heading", {
      name: "Nickel iron oxide catalyst with a deliberately long preparation identifier",
    })
  ).toBeVisible()
  await panel.getByRole("link", { name: "Back in preview" }).click()
  await expect(page).toHaveURL(new RegExp(`preview=${sampleTwo}`))
  await expect(
    panel.getByRole("heading", { name: "Catalyst sample 2" })
  ).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(sharedProjectUrl)
  await expect(panel).toHaveCount(0)
  await page.goForward()
  await expect(page).toHaveURL(new RegExp(`preview=${sampleTwo}`))
  await expect(panel).toBeVisible()
  const open = panel.getByRole("link", {
    name: "Open full page: Catalyst sample 2",
    exact: true,
  })
  await expect(open).toHaveText("Open")
  await expect(open.locator('[data-icon="inline-end"]')).toBeVisible()
  await open.click()
  await expect(page).toHaveURL(new RegExp(`/hub/samples/${sampleTwo}`))
  await page.goBack()
  await expect(page).toHaveURL(new RegExp(`preview=${sampleTwo}`))
  await expect(panel).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(panel).toHaveCount(0)
  await expect(
    sampleRow(page, "Catalyst sample 2").getByRole("link", {
      name: "Preview Catalyst sample 2",
      exact: true,
    })
  ).toBeVisible()
})

test("direct, malformed, and failed previews preserve project state", async ({
  page,
}) => {
  const filteredUrl = `${projectPath}?scenario=dense&kind=datasets&scope=shared&sampleCursor=fixture%3A1&datasetCursor=fixture%3A1`
  await page.goto(`${filteredUrl}&preview=${datasetTwo}`)
  await page.waitForLoadState("networkidle")
  const panel = page.getByRole("dialog")
  await expect(
    panel.getByRole("heading", { name: "Measurement dataset 2" })
  ).toBeVisible()
  await expect(
    panel.getByRole("link", { name: "Back in preview" })
  ).toHaveCount(0)
  await page.evaluate(() => {
    history.replaceState(
      {
        ...history.state,
        resourcePreview: {
          origin: "cross-origin-project",
          owner: "forged-owner",
          previous: ["forged-resource"],
        },
      },
      ""
    )
  })
  await page.reload()
  await expect(panel).toBeVisible()
  await expect(
    panel.getByRole("link", { name: "Back in preview" })
  ).toHaveCount(0)
  await panel.getByRole("button", { name: "Close", exact: true }).click()
  await expect(page).toHaveURL(filteredUrl)

  const resourceRequests: string[] = []
  page.on("request", (request) => {
    if (isResourceRequest(request.url())) resourceRequests.push(request.url())
  })
  await page.goto(`${filteredUrl}&preview=${encodeURIComponent("../private")}`)
  await expect(
    panel.getByRole("heading", { name: "Invalid resource preview" })
  ).toBeVisible()
  await expect(panel.getByRole("alert")).toHaveText(
    "The preview identifier is not valid."
  )
  await expect(page.locator("main h1")).toHaveText(
    "A deliberately long project title for validating dense desktop layouts"
  )
  expect(resourceRequests).toHaveLength(0)
  await panel.getByRole("button", { name: "Close", exact: true }).click()
  await expect(page).toHaveURL(filteredUrl)

  let failDetail = true
  await page.route("**/hub/_serverFn/**", async (route) => {
    if (
      failDetail &&
      isResourceRequest(route.request().url(), "fixture-dataset-3")
    ) {
      await route.abort("failed")
      return
    }
    await route.continue()
  })
  await page
    .getByRole("link", { name: "Preview Measurement dataset 3" })
    .click()
  await expect(
    panel.getByText("Resource details could not be loaded.")
  ).toBeVisible({ timeout: 15_000 })
  await expect(page.locator("main h1")).toHaveText(
    "A deliberately long project title for validating dense desktop layouts"
  )
  failDetail = false
  await panel.getByRole("button", { name: "Try again" }).click()
  await expect(
    panel.getByRole("heading", { name: "Measurement dataset 3" })
  ).toBeVisible()
  await panel.getByRole("button", { name: "Close", exact: true }).click()
  await expect(page).toHaveURL(filteredUrl)
})

test("project inspector matches wide light and compact dark baselines", async ({
  page,
}) => {
  const cases = [
    {
      name: "project-inspector-wide-light",
      theme: "light",
      viewport: { width: 1440, height: 900 },
    },
    {
      name: "project-inspector-compact-dark",
      theme: "dark",
      viewport: { width: 390, height: 844 },
    },
  ] as const

  for (const visualCase of cases) {
    await page.setViewportSize(visualCase.viewport)
    await page.emulateMedia({
      colorScheme: visualCase.theme,
      reducedMotion: "reduce",
    })
    await page.addInitScript((theme) => {
      localStorage.setItem("crucible-hub-theme", theme)
    }, visualCase.theme)
    await page.goto(`${sharedProjectUrl}&preview=${sampleTwo}`)
    await page.waitForLoadState("networkidle")
    const panel = page.getByRole("dialog")
    await expect(
      panel.getByRole("heading", { name: "Catalyst sample 2" })
    ).toBeVisible()
    await expect(page.locator("html")).toHaveClass(new RegExp(visualCase.theme))
    await expect(new AxeBuilder({ page }).analyze()).resolves.toMatchObject({
      violations: [],
    })
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
      )
      .toBe(true)
    await expect(page).toHaveScreenshot(`${visualCase.name}.png`, {
      animations: "disabled",
      caret: "hide",
      fullPage: false,
    })
    await page.keyboard.press("Escape")
    await expect(panel).toHaveCount(0)
    await expect
      .poll(() =>
        page
          .locator('[data-slot="table-container"]')
          .evaluate((element) => element.scrollWidth <= element.clientWidth)
      )
      .toBe(true)
    await expect(new AxeBuilder({ page }).analyze()).resolves.toMatchObject({
      violations: [],
    })
  }
})
