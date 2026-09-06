import AxeBuilder from "@axe-core/playwright"
import type { Page, Request } from "@playwright/test"

import { expect, test } from "../fixtures"

const datasetPath = "/hub/datasets/01J6Y8N4Q2R7M9K3T5V0W1X2Z7"
const readyFile = "operando-cycle-04.h5"
const readyFileMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2ZC"
const unavailableFile = "run-notes.txt"
const unavailableFileMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2ZD"

function isDownloadRequest(request: Request) {
  return (
    request.method() === "POST" &&
    request.url().includes("/hub/_serverFn/") &&
    request.postData()?.includes("fileMfid") === true
  )
}

function fileRow(page: Page, filename: string) {
  return page.getByRole("row").filter({ hasText: filename })
}

test("keeps download capabilities lazy and accessible on compact screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" })
  await page.addInitScript(() => {
    localStorage.setItem("crucible-hub-theme", "dark")
  })
  const downloadRequests: Request[] = []
  page.on("request", (request) => {
    if (isDownloadRequest(request)) downloadRequests.push(request)
  })

  await page.goto(datasetPath)
  await page.waitForLoadState("networkidle")
  const download = fileRow(page, readyFile).getByRole("button", {
    name: `Download ${readyFile}`,
  })
  const unavailable = fileRow(page, unavailableFile).getByRole("button", {
    name: `Download unavailable for ${unavailableFile}`,
  })
  await expect(download).toBeVisible()
  await expect(unavailable).toBeDisabled()
  expect(downloadRequests).toHaveLength(0)

  await download.hover()
  await expect(
    page.getByText(`Download ${readyFile}`, { exact: true })
  ).toBeVisible()
  expect(downloadRequests).toHaveLength(0)

  const canonical = page.getByRole("link", {
    name: "Open full page: NiFe oxide catalyst A",
  })
  await canonical.hover()
  await expect(
    page.getByText("Open full page: NiFe oxide catalyst A", { exact: true })
  ).toBeVisible()
  expect(downloadRequests).toHaveLength(0)
  await page.locator("main h1").hover()
  await expect(
    page.getByText("Open full page: NiFe oxide catalyst A", { exact: true })
  ).toBeHidden()

  await expect(new AxeBuilder({ page }).analyze()).resolves.toMatchObject({
    violations: [],
  })
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
    )
    .toBe(true)
  await expect
    .poll(() =>
      page
        .locator('[data-slot="table-container"]')
        .evaluate((element) =>
          ["auto", "scroll"].includes(getComputedStyle(element).overflowX)
        )
    )
    .toBe(true)
})

test("requests only the selected file and hands off a fresh capability", async ({
  page,
}) => {
  const downloadRequests: Request[] = []
  let handoffs = 0
  let releaseRequest = () => {}
  const heldRequest = new Promise<void>((resolve) => {
    releaseRequest = resolve
  })
  page.on("request", (request) => {
    if (isDownloadRequest(request)) downloadRequests.push(request)
  })
  await page.route("**/hub/_serverFn/**", async (route) => {
    if (!isDownloadRequest(route.request())) {
      await route.continue()
      return
    }
    await heldRequest
    await route.continue()
  })
  await page.route("https://downloads.crucible.invalid/**", async (route) => {
    expect(route.request().headers()["referer"]).toBeUndefined()
    handoffs += 1
    await route.fulfill({ status: 204 })
  })
  await page.goto(datasetPath)
  await page.waitForLoadState("networkidle")
  const row = fileRow(page, readyFile)
  const download = row.getByRole("button", {
    name: `Download ${readyFile}`,
  })
  await download.focus()
  const rowBoxBefore = await row.boundingBox()
  const unavailableRowBoxBefore = await fileRow(
    page,
    unavailableFile
  ).boundingBox()

  await page.keyboard.press("Enter")
  const pendingDownload = row.getByRole("button", {
    name: `Preparing download for ${readyFile}`,
  })
  await expect(pendingDownload).toBeDisabled()
  await expect(pendingDownload).toHaveAttribute("aria-busy", "true")
  await expect(row.getByRole("status")).toHaveText(
    `Preparing download for ${readyFile}`
  )
  expect(await row.boundingBox()).toEqual(rowBoxBefore)
  expect(await fileRow(page, unavailableFile).boundingBox()).toEqual(
    unavailableRowBoxBefore
  )
  expect(downloadRequests).toHaveLength(1)
  expect(downloadRequests[0].postData()).toContain(readyFileMfid)
  expect(downloadRequests[0].postData()).not.toContain(unavailableFileMfid)

  releaseRequest()
  await expect.poll(() => handoffs).toBe(1)
  await expect(download).toBeEnabled()
  await download.click({ noWaitAfter: true })
  await expect.poll(() => downloadRequests.length).toBe(2)
  await expect.poll(() => handoffs).toBe(2)
  expect(downloadRequests[1].postData()).toContain(readyFileMfid)
  expect(downloadRequests[1].postData()).not.toContain(unavailableFileMfid)
})

test("keeps a failed download local and retries only that file", async ({
  page,
}) => {
  let failNextDownload = true
  let downloadRequests = 0
  let handoffs = 0
  await page.route("**/hub/_serverFn/**", async (route) => {
    if (!isDownloadRequest(route.request())) {
      await route.continue()
      return
    }
    downloadRequests += 1
    if (failNextDownload) {
      failNextDownload = false
      await route.abort("failed")
      return
    }
    await route.continue()
  })
  await page.route("https://downloads.crucible.invalid/**", async (route) => {
    expect(route.request().headers()["referer"]).toBeUndefined()
    handoffs += 1
    await route.fulfill({ status: 204 })
  })
  await page.goto(datasetPath)
  await page.waitForLoadState("networkidle")
  const row = fileRow(page, readyFile)
  const download = row.getByRole("button", {
    name: `Download ${readyFile}`,
  })
  await download.scrollIntoViewIfNeeded()
  const rowBoxBefore = await row.boundingBox()

  await download.click()
  await expect(row.getByRole("alert")).toContainText(
    "Download could not be prepared."
  )
  await expect(page.getByRole("table")).toBeVisible()
  await expect(
    fileRow(page, unavailableFile).getByRole("button", {
      name: `Download unavailable for ${unavailableFile}`,
    })
  ).toBeDisabled()
  expect(await row.boundingBox()).toEqual(rowBoxBefore)
  expect(downloadRequests).toBe(1)
  expect(handoffs).toBe(0)

  await row
    .getByRole("button", { name: `Retry download for ${readyFile}` })
    .click({ noWaitAfter: true })
  await expect.poll(() => downloadRequests).toBe(2)
  await expect.poll(() => handoffs).toBe(1)
  await expect(row.getByRole("alert")).toHaveCount(0)
})
