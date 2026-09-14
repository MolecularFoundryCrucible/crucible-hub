import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"

import { expect, test } from "../fixtures"

const sampleFiftyOne = "fixture-sample-51"
const sampleOne = "fixture-sample-1"
const datasetOne = "fixture-dataset-1"
const datasetFiftyOne = "fixture-dataset-51"
const sampleOneName =
  "Nickel iron oxide catalyst with a deliberately long preparation identifier"
const pagedDataUrl =
  "/hub/data?scenario=dense&kind=samples&sampleCursor=fixture%3A50"
const filteredDataUrl =
  "/hub/data?scenario=dense&kind=samples&projectMfid=fixture-project-1&projectScope=all"
const compactDataUrl =
  "/hub/data?scenario=dense&kind=datasets&datasetCursor=fixture%3A50"

function isCollectionRequest(url: string) {
  return (
    url.includes("/hub/_serverFn/") &&
    decodeURIComponent(url).includes('"k":["cursor","limit"')
  )
}

function isResourceRequest(url: string, resourceMfid?: string) {
  const decoded = decodeURIComponent(url)
  return (
    url.includes("/hub/_serverFn/") &&
    decoded.includes("resourceMfid") &&
    (!resourceMfid || decoded.includes(resourceMfid))
  )
}

function isDatasetFilesRequest(url: string) {
  return (
    url.includes("/hub/_serverFn/") &&
    decodeURIComponent(url).includes("datasetMfid")
  )
}

function dataRow(page: Page, name: string) {
  return page.getByRole("row").filter({
    has: page.getByRole("link", { name: `Preview ${name}`, exact: true }),
  })
}

function currentSearch(page: Page) {
  return Object.fromEntries(new URL(page.url()).searchParams)
}

test("filtered paginated Data preview preserves the collection and restores focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(pagedDataUrl)
  await page.waitForLoadState("networkidle")

  const heading = page.locator("main h1")
  const table = page.locator('[data-slot="table-container"]')
  const headingBefore = await heading.boundingBox()
  const tableBefore = await table.boundingBox()
  const scrollBefore = await page.evaluate(() => ({ x: scrollX, y: scrollY }))
  const row = dataRow(page, "Catalyst sample 51")
  const trigger = row.getByRole("link", {
    name: "Preview Catalyst sample 51",
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
  const direct = row.getByRole("link", {
    name: "Open full page: Catalyst sample 51",
    exact: true,
  })
  await expect(direct.locator(".resource-full-page-link-label")).toBeHidden()
  await expect(direct.locator("svg")).toBeVisible()
  const collectionResponses: string[] = []
  const resourceResponses: string[] = []
  const fileResponses: string[] = []
  page.on("response", (response) => {
    if (!response.ok()) return
    const url = response.url()
    if (isCollectionRequest(url)) collectionResponses.push(url)
    if (isResourceRequest(url)) resourceResponses.push(url)
    if (isDatasetFilesRequest(url)) fileResponses.push(url)
  })

  await expect(trigger).toHaveAttribute(
    "href",
    new RegExp(`preview=${sampleFiftyOne}`)
  )
  const modifierPrevented = await trigger.evaluate((element) => {
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    })
    element.dispatchEvent(event)
    return event.defaultPrevented
  })
  expect(modifierPrevented).toBe(false)
  expect(currentSearch(page)).toEqual({
    kind: "samples",
    sampleCursor: "fixture:50",
    scenario: "dense",
  })

  await trigger.click()
  const panel = page.getByRole("dialog")
  await expect(
    panel.getByRole("heading", { name: "Catalyst sample 51" })
  ).toBeVisible()
  await expect(
    panel.getByRole("heading", { name: "Catalyst sample 51" })
  ).toBeFocused()
  expect(currentSearch(page)).toEqual({
    kind: "samples",
    preview: sampleFiftyOne,
    sampleCursor: "fixture:50",
    scenario: "dense",
  })
  expect(await heading.boundingBox()).toEqual(headingBefore)
  expect(await table.boundingBox()).toEqual(tableBefore)
  expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual(
    scrollBefore
  )
  await expect
    .poll(
      () =>
        resourceResponses.filter((url) =>
          isResourceRequest(url, sampleFiftyOne)
        ).length
    )
    .toBe(1)
  expect(resourceResponses).toHaveLength(1)
  expect(collectionResponses).toHaveLength(0)
  expect(fileResponses).toHaveLength(0)

  await page.evaluate(() => scrollBy(0, 400))
  const scrollBeforeClose = await page.evaluate(() => ({
    x: scrollX,
    y: scrollY,
  }))
  await panel.getByRole("button", { name: "Close", exact: true }).click()
  await expect(panel).toHaveCount(0)
  await expect(trigger).toBeFocused()
  expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual(
    scrollBeforeClose
  )
  expect(currentSearch(page)).toEqual({
    kind: "samples",
    sampleCursor: "fixture:50",
    scenario: "dense",
  })
})

test("moves through the originating collection from canonical detail", async ({
  page,
}) => {
  await page.goto("/hub/data?scenario=dense&kind=samples")
  await page.waitForLoadState("networkidle")
  const resourceRequests: string[] = []
  page.on("request", (request) => {
    if (isResourceRequest(request.url())) resourceRequests.push(request.url())
  })

  await dataRow(page, "Catalyst sample 9")
    .getByRole("link", {
      name: "Open full page: Catalyst sample 9",
      exact: true,
    })
    .click()

  await expect(page).toHaveURL(/\/hub\/samples\/fixture-sample-9/)
  const siblings = page.getByRole("navigation", {
    name: "Resource sequence navigation",
  })
  await expect(siblings).toBeVisible()
  await expect(
    siblings.getByRole("button", { name: "Previous item", exact: true })
  ).toBeDisabled()
  await expect(
    siblings.getByRole("link", { name: "Next item: Catalyst sample 8" })
  ).toBeVisible()
  expect(
    resourceRequests.filter((url) => isResourceRequest(url, "fixture-sample-8"))
  ).toHaveLength(0)

  await page.keyboard.press("ArrowRight")
  await expect(page).toHaveURL(/\/hub\/samples\/fixture-sample-8/)
  await expect(page.locator("main h1")).toHaveText("Catalyst sample 8")
  await expect(siblings).toContainText("Samples · Default order")

  await page.reload()
  await expect(siblings).toBeVisible()
  await expect(
    siblings.getByRole("button", { name: /Change resource sequence/ })
  ).toContainText("Browse nearby resources")
})

test("reconfigures sibling navigation from canonical detail", async ({
  page,
}) => {
  await page.goto("/hub/data?scenario=dense&kind=samples")
  await page.waitForLoadState("networkidle")

  await dataRow(page, "Catalyst sample 51")
    .getByRole("link", {
      name: "Open full page: Catalyst sample 51",
      exact: true,
    })
    .click()

  const siblings = page.getByRole("navigation", {
    name: "Resource sequence navigation",
  })
  await siblings
    .getByRole("button", { name: /Change resource sequence/ })
    .click()

  const dialog = page.getByRole("dialog", { name: "Browse nearby samples" })
  await dialog.getByLabel("Include").selectOption("all")
  await dialog.getByRole("button", { name: "Apply", exact: true }).click()
  await expect(dialog).toHaveCount(0)

  await expect(
    siblings.getByRole("link", { name: /^Previous item:/ })
  ).toBeVisible()
  await expect(
    siblings.getByRole("link", { name: /^Next item:/ })
  ).toBeVisible()

  await page.keyboard.press("ArrowRight")
  await expect(page.locator("main h1")).toHaveText("Catalyst sample 52")
  await page.keyboard.press("ArrowLeft")
  await expect(page.locator("main h1")).toHaveText("Catalyst sample 51")
})

test("Data preview follows relationships and promotes to a canonical page", async ({
  page,
}) => {
  await page.goto(filteredDataUrl)
  await page.waitForLoadState("networkidle")
  const row = dataRow(page, sampleOneName)
  const direct = row.getByRole("link", {
    name: `Open full page: ${sampleOneName}`,
    exact: true,
  })
  await expect(direct.locator(".resource-full-page-link-label")).toBeHidden()
  await direct.click()
  await expect(page).toHaveURL(`/hub/samples/${sampleOne}?scenario=dense`)
  await page.goBack()
  await expect(page).toHaveURL(filteredDataUrl)
  await row
    .getByRole("link", { name: `Preview ${sampleOneName}`, exact: true })
    .click()

  const panel = page.getByRole("dialog")
  await expect(
    panel.getByRole("heading", { name: sampleOneName })
  ).toBeVisible()
  await panel
    .getByRole("link", {
      name: "Preview Operando spectroscopy acquisition",
      exact: true,
    })
    .click()
  await expect(
    panel.getByRole("heading", { name: /Operando spectroscopy acquisition/ })
  ).toBeVisible()
  expect(currentSearch(page)).toEqual({
    kind: "samples",
    preview: datasetOne,
    projectMfid: "fixture-project-1",
    projectScope: "all",
    scenario: "dense",
  })

  await panel.getByRole("link", { name: "Previous preview" }).click()
  await expect(
    panel.getByRole("heading", { name: sampleOneName })
  ).toBeVisible()
  await panel
    .getByRole("link", {
      name: "Preview Operando spectroscopy acquisition",
      exact: true,
    })
    .click()
  const open = panel.getByRole("link", { name: /^Open full page:/ })
  await expect(open).toHaveText("Open")
  await expect(open.locator('[data-icon="inline-end"]')).toBeVisible()
  const destination = new URL(
    (await open.getAttribute("href")) ?? "",
    page.url()
  )
  expect(destination.pathname).toBe(`/hub/datasets/${datasetOne}`)
  expect(Object.fromEntries(destination.searchParams)).toEqual({
    scenario: "dense",
  })

  await open.click()
  await expect(page).toHaveURL(`/hub/datasets/${datasetOne}?scenario=dense`)
  await page.goBack()
  await expect(page).toHaveURL(new RegExp(`/hub/data\\?`))
  await expect(panel).toBeVisible()
  expect(currentSearch(page)).toEqual({
    kind: "samples",
    preview: datasetOne,
    projectMfid: "fixture-project-1",
    projectScope: "all",
    scenario: "dense",
  })
})

test("direct and malformed Data previews close safely on compact screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" })
  await page.addInitScript(() => {
    localStorage.setItem("crucible-hub-theme", "dark")
  })

  await page.goto(`${compactDataUrl}&preview=${datasetFiftyOne}`)
  await page.waitForLoadState("networkidle")
  const panel = page.getByRole("dialog")
  await expect(
    panel.getByRole("heading", { name: "Measurement dataset 51" })
  ).toBeVisible()
  await expect(
    panel.getByRole("link", { name: "Previous preview" })
  ).toHaveCount(0)
  await page.reload()
  await expect(
    panel.getByRole("heading", { name: "Measurement dataset 51" })
  ).toBeVisible()
  await expect(
    panel.getByRole("link", { name: "Previous preview" })
  ).toHaveCount(0)
  await expect(new AxeBuilder({ page }).analyze()).resolves.toMatchObject({
    violations: [],
  })
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
    )
    .toBe(true)
  await panel.getByRole("button", { name: "Close", exact: true }).click()
  await expect(panel).toHaveCount(0)
  expect(currentSearch(page)).toEqual({
    datasetCursor: "fixture:50",
    kind: "datasets",
    scenario: "dense",
  })

  const resourceRequests: string[] = []
  page.on("request", (request) => {
    if (isResourceRequest(request.url())) resourceRequests.push(request.url())
  })
  await page.goto(
    `${compactDataUrl}&preview=${encodeURIComponent("../private")}`
  )
  await page.waitForLoadState("networkidle")
  await expect(
    panel.getByRole("heading", { name: "Invalid resource preview" })
  ).toBeVisible()
  await expect(panel.getByRole("alert")).toHaveText(
    "The preview identifier is not valid."
  )
  expect(resourceRequests).toHaveLength(0)
  await panel.getByRole("button", { name: "Close", exact: true }).click()
  await expect(panel).toHaveCount(0)
  expect(currentSearch(page)).toEqual({
    datasetCursor: "fixture:50",
    kind: "datasets",
    scenario: "dense",
  })
})
