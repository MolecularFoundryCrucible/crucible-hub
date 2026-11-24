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

const attachmentResponse = {
  body: "",
  headers: { "content-disposition": 'attachment; filename="file.h5"' },
  status: 200,
}

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
    await route.fulfill(attachmentResponse)
  })
  await page.goto(datasetPath)
  await page.waitForLoadState("networkidle")
  const row = fileRow(page, readyFile)
  const download = row.getByRole("button", {
    name: `Download ${readyFile}`,
  })
  await expect(
    fileRow(page, unavailableFile).getByRole("button", {
      name: `Download unavailable for ${unavailableFile}`,
    })
  ).toBeDisabled()
  await download.hover()
  expect(downloadRequests).toHaveLength(0)
  await download.focus()

  await page.keyboard.press("Enter")
  const pendingDownload = row.getByRole("button", {
    name: `Preparing download for ${readyFile}`,
  })
  await expect(pendingDownload).toBeDisabled()
  await expect(pendingDownload).toHaveAttribute("aria-busy", "true")
  await expect(row.getByRole("status")).toHaveText(
    `Preparing download for ${readyFile}`
  )
  expect(downloadRequests).toHaveLength(1)
  expect(downloadRequests[0]!.postData()).toContain(readyFileMfid)
  expect(downloadRequests[0]!.postData()).not.toContain(unavailableFileMfid)

  releaseRequest()
  await expect.poll(() => handoffs).toBe(1)
  await expect(download).toBeEnabled()
  await download.click({ noWaitAfter: true })
  await expect.poll(() => downloadRequests.length).toBe(2)
  await expect.poll(() => handoffs).toBe(2)
  expect(downloadRequests[1]!.postData()).toContain(readyFileMfid)
  expect(downloadRequests[1]!.postData()).not.toContain(unavailableFileMfid)
})

test("opens stored files inline through a fresh link per visit", async ({
  page,
  request,
}) => {
  await page.goto(datasetPath)
  const open = fileRow(page, readyFile).getByRole("link", {
    name: `Open ${readyFile} in a new tab`,
  })
  await expect(open).toHaveAttribute(
    "href",
    `/hub/files/${readyFileMfid}/open?scenario=populated`
  )
  await expect(open).toHaveAttribute("target", "_blank")
  await expect(
    fileRow(page, unavailableFile).getByRole("link", {
      name: `Open ${unavailableFile} in a new tab`,
    })
  ).toHaveCount(0)

  const opened = await request.get(
    `/hub/files/${readyFileMfid}/open?scenario=populated`,
    { maxRedirects: 0 }
  )
  expect(opened.status()).toBe(302)
  expect(opened.headers()["location"]).toBe(
    `https://downloads.crucible.invalid/files/${readyFileMfid}?disposition=inline`
  )
  expect(opened.headers()["cache-control"]).toBe("no-store")

  for (const [fileMfid, reason] of [
    [unavailableFileMfid, "unavailable"],
    ["missing-file", "not-found"],
  ]) {
    const refused = await request.get(
      `/hub/files/${fileMfid}/open?scenario=populated`,
      { maxRedirects: 0 }
    )
    expect(refused.status()).toBe(303)
    expect(refused.headers()["location"]).toBe(
      `/hub/files/unavailable?reason=${reason}`
    )
  }

  await page.goto("/hub/files/unavailable?reason=unavailable")
  await expect(
    page.getByRole("heading", { name: "File unavailable" })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Return to Crucible Hub" })
  ).toBeVisible()
})
