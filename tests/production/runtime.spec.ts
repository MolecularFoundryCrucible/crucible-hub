import type { Request } from "@playwright/test"

import { expect, test } from "../fixtures"

function isFileDownloadRequest(request: Request) {
  return (
    request.method() === "POST" &&
    request.url().includes("/hub/_serverFn/") &&
    request.postData()?.includes("fileMfid") === true
  )
}

test("serves prefixed production assets and direct deep links", async ({
  page,
}) => {
  await page.goto("/hub/data")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Samples and Datasets"
  )
  const favicon = page.locator('link[rel="icon"]')
  await expect(favicon).toHaveAttribute(
    "href",
    /^\/hub\/assets\/crucible-logo-hub-[A-Za-z0-9_-]+\.svg$/
  )
  await expect(favicon).toHaveAttribute("type", "image/svg+xml")
  const faviconHref = await favicon.getAttribute("href")
  if (!faviconHref) throw new Error("Favicon URL is missing")
  const faviconResponse = await page.request.get(faviconHref)
  expect(faviconResponse.status()).toBe(200)
  expect(faviconResponse.headers()["content-type"]).toContain("image/svg+xml")

  const resourceUrls = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => new URL(entry.name).pathname)
      .filter((path) => path.includes("/assets/"))
  )
  expect(resourceUrls.length).toBeGreaterThan(0)
  expect(resourceUrls.every((path) => path.startsWith("/hub/assets/"))).toBe(
    true
  )
})

test("uses server functions during production project navigation", async ({
  page,
}) => {
  await page.goto("/hub/projects")
  const projectDataResponses: string[] = []
  page.on("response", (response) => {
    const url = response.url()
    if (
      response.ok() &&
      url.includes("/hub/_serverFn/") &&
      decodeURIComponent(url).includes("projectScope")
    ) {
      projectDataResponses.push(url)
    }
  })
  await page
    .getByRole("link", { name: "Operando Catalyst Mapping" })
    .first()
    .click()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Operando Catalyst Mapping"
  )
  await expect(page.getByLabel("Project data type")).toBeVisible()
  expect(projectDataResponses).toHaveLength(1)
  const samplesHandler = new URL(projectDataResponses[0]).pathname
  await page
    .getByLabel("Project data type")
    .getByRole("button", { name: "Datasets" })
    .click()
  await expect(
    page.getByRole("link", { name: /Preview NiFe K-edge/ })
  ).toBeVisible()
  expect(projectDataResponses).toHaveLength(2)
  expect(new URL(projectDataResponses[1]).pathname).not.toBe(samplesHandler)
  const projectSections = page.getByRole("navigation", {
    name: "Project sections",
  })
  await projectSections.getByRole("link", { name: "Overview" }).click()
  await expect(page.getByText("Summary", { exact: true })).toBeVisible()
  await expect(page.getByText("People", { exact: true })).toBeVisible()
})

test("keeps health public, minimal, and outside the application shell", async ({
  request,
}) => {
  const response = await request.get("/hub/health")
  expect(response.status()).toBe(200)
  expect(response.headers()["cache-control"]).toBe("no-store")
  expect(await response.json()).toEqual({ status: "ok" })
})

test("uses one-shot file downloads in the production runtime", async ({
  page,
}) => {
  const downloadRequests: Request[] = []
  let handoffs = 0
  page.on("request", (request) => {
    if (isFileDownloadRequest(request)) downloadRequests.push(request)
  })
  await page.route("https://downloads.crucible.invalid/**", async (route) => {
    expect(route.request().headers()["referer"]).toBeUndefined()
    handoffs += 1
    await route.fulfill({ status: 204 })
  })

  await page.goto("/hub/datasets/01J6Y8N4Q2R7M9K3T5V0W1X2Z7")
  await page.waitForLoadState("networkidle")
  expect(downloadRequests).toHaveLength(0)
  await page
    .getByRole("button", { name: "Download operando-cycle-04.h5" })
    .click({ noWaitAfter: true })
  await expect.poll(() => downloadRequests.length).toBe(1)
  await expect.poll(() => handoffs).toBe(1)
})

test("restores project preview deep links in the production runtime", async ({
  page,
}) => {
  const project = "/hub/projects/01J6Y8N4Q2R7M9K3T5V0W1X2Z3"
  const dataset = "01J6Y8N4Q2R7M9K3T5V0W1X2Z7"
  const collection = `${project}?kind=datasets&scope=assigned&createdFrom=2026-08-01&createdTo=2026-08-31&instrumentMfid=01J6Y8N4Q2R7M9K3T5V0W1X2Z4`
  await page.goto(`${collection}&preview=${dataset}`)
  await page.waitForLoadState("networkidle")
  const panel = page.getByRole("dialog")
  await expect(page.locator("main h1")).toHaveText("Operando Catalyst Mapping")
  await expect(
    panel.getByRole("heading", { name: "NiFe K-edge operando series" })
  ).toBeVisible()
  await panel.getByRole("button", { name: "Close", exact: true }).click()
  await expect(page).toHaveURL(collection)
  await expect(panel).toHaveCount(0)
  await page
    .getByRole("link", { name: "Preview NiFe K-edge operando series" })
    .click()
  const open = panel.getByRole("link", {
    name: "Open full page: NiFe K-edge operando series",
    exact: true,
  })
  await expect(open).toHaveText("Open")
  await expect(open.locator('[data-icon="inline-end"]')).toBeVisible()
  await open.click()
  await expect(page).toHaveURL(
    `/hub/datasets/${dataset}?fromProject=01J6Y8N4Q2R7M9K3T5V0W1X2Z3`
  )
  await page.goBack()
  await expect(page).toHaveURL(`${collection}&preview=${dataset}`)
  await expect(panel).toBeVisible()
})

test("serves nested instrument datasets with production navigation", async ({
  page,
}) => {
  await page.goto("/hub/instruments/01J6Y8N4Q2R7M9K3T5V0W1X2Z4/datasets")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Hard X-ray Microprobe"
  )
  await expect(
    page.getByRole("link", {
      name: "Preview NiFe K-edge operando series",
    })
  ).toBeVisible()
  await page
    .getByRole("navigation", { name: "Instrument sections" })
    .getByRole("link", { name: "Overview" })
    .click()
  await expect(page.getByText("Summary", { exact: true })).toBeVisible()
})

test("hydrates full page loads in the Administrator view", async ({ page }) => {
  await page.setViewportSize({ height: 800, width: 1280 })
  await page.goto("/hub/?scenario=populated")
  await page.waitForLoadState("networkidle")
  await page.getByRole("switch", { name: "Administrator view" }).click()
  await expect(
    page.getByRole("switch", { name: "Administrator view" })
  ).toBeChecked()
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  for (const path of [
    "/hub/",
    "/hub/projects",
    "/hub/instruments",
    "/hub/data",
    "/hub/deletion-requests",
    "/hub/deletion-requests?view=approved",
    "/hub/admin/users",
  ]) {
    await page.goto(path)
    await page.waitForLoadState("networkidle")
  }
  expect(errors).toEqual([])
})
