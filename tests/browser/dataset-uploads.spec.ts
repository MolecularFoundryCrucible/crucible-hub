import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"

import { expect, test } from "../fixtures"

const datasetPath = "/hub/datasets/01J6Y8N4Q2R7M9K3T5V0W1X2Z7"
const runId = Date.now().toString(36)
const uploadedFilename = `operando-cycle-05-${runId}.h5`
const secondFilename = `operando-cycle-06-${runId}.h5`
const failedFilename = `operando-cycle-07-${runId}.h5`

function dialog(page: Page) {
  return page.getByRole("dialog", { name: "Add files" })
}

async function chooseFiles(
  page: Page,
  files: { name: string; text: string }[]
) {
  await dialog(page)
    .getByLabel("Files to upload")
    .setInputFiles(
      files.map((file) => ({
        buffer: Buffer.from(file.text),
        mimeType: "application/octet-stream",
        name: file.name,
      }))
    )
}

test("keeps the add files action gated and the dialog accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" })
  await page.addInitScript(() => {
    localStorage.setItem("crucible-hub-theme", "dark")
  })

  await page.goto(datasetPath)
  await page.waitForLoadState("networkidle")
  const addFiles = page.getByRole("button", { name: "Add files" })
  await expect(addFiles).toBeVisible()

  await addFiles.click()
  await expect(dialog(page)).toBeVisible()
  await expect(
    dialog(page).getByRole("button", { name: "Choose files" })
  ).toBeVisible()
  await expect(
    dialog(page).getByRole("button", { name: "Choose folder" })
  ).toBeVisible()
  await expect(
    dialog(page).getByRole("button", { name: "Upload files" })
  ).toBeDisabled()

  await chooseFiles(page, [{ name: uploadedFilename, text: "cycle 05" }])
  await expect(
    dialog(page).getByRole("combobox", {
      name: `Ingestor for ${uploadedFilename}`,
    })
  ).toBeVisible()

  await expect(new AxeBuilder({ page }).analyze()).resolves.toMatchObject({
    violations: [],
  })

  await dialog(page).locator('[data-slot="dialog-close"]').click()
  await expect(dialog(page)).toHaveCount(0)
})

test("uploads files, requests ingestion, and starts empty when reopened", async ({
  page,
}) => {
  const partPuts: string[] = []
  page.on("request", (request) => {
    if (request.method() === "PUT") partPuts.push(request.url())
  })

  await page.goto(datasetPath)
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: "Add files" }).click()

  await chooseFiles(page, [
    { name: uploadedFilename, text: "measured potential values for cycle 05" },
    { name: secondFilename, text: "measured values for cycle 06" },
  ])
  await dialog(page)
    .getByLabel("Ingestor for all")
    .selectOption({ label: "Auto-detect" })
  await dialog(page)
    .getByRole("combobox", { name: `Ingestor for ${secondFilename}` })
    .selectOption({ label: "No ingestion" })

  await dialog(page).getByRole("button", { name: "Upload 2 files" }).click()
  await expect(dialog(page).getByText("Ingestion requested")).toHaveCount(1, {
    timeout: 15000,
  })
  await expect(dialog(page).getByText("Uploaded as")).toHaveCount(2)
  expect(partPuts.length).toBeGreaterThan(0)
  for (const url of partPuts) {
    expect(url).toContain("fixture-uploads")
  }

  await dialog(page).getByRole("button", { name: "Done" }).click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(
    page.getByRole("row").filter({ hasText: uploadedFilename })
  ).toBeVisible()
  expect(await page.content()).not.toContain("fixture-uploads")

  await page.getByRole("button", { name: "Add files" }).click()
  await expect(
    dialog(page).getByRole("list", { name: "Selected files" })
  ).toHaveCount(0)
})

test("shows files added elsewhere after refreshing the dataset", async ({
  browser,
  page,
}) => {
  const filename = `refresh-${runId}.h5`
  await page.goto(datasetPath)
  await page.waitForLoadState("networkidle")

  const other = await browser.newPage()
  await other.goto(datasetPath)
  await other.waitForLoadState("networkidle")
  await other.getByRole("button", { name: "Add files" }).click()
  await chooseFiles(other, [{ name: filename, text: "added from another tab" }])
  await dialog(other).getByRole("button", { name: "Upload 1 file" }).click()
  await dialog(other).getByRole("button", { name: "Done" }).waitFor()
  await other.close()

  await expect(page.getByRole("row").filter({ hasText: filename })).toHaveCount(
    0
  )
  await page.getByRole("button", { name: /^Refresh details for / }).click()
  await expect(
    page.getByRole("row").filter({ hasText: filename })
  ).toBeVisible()
  await expect(page.getByText("Refreshing file metadata")).toHaveCount(0)
})

test("flags duplicate names before uploading", async ({ page }) => {
  await page.goto(datasetPath)
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: "Add files" }).click()

  await chooseFiles(page, [{ name: "a.h5", text: "first" }])
  await chooseFiles(page, [{ name: "a.h5", text: "second" }])
  await expect(
    dialog(page).getByText("Another file in this list has the same name.")
  ).toHaveCount(2)
  await expect(
    dialog(page).getByRole("button", { name: "Upload 2 files" })
  ).toBeDisabled()

  await dialog(page)
    .getByRole("textbox", { name: "File name for a.h5" })
    .last()
    .fill("b.h5")
  await expect(
    dialog(page).getByRole("button", { name: "Upload 2 files" })
  ).toBeEnabled()
})

test("adds dropped files to the list", async ({ page }) => {
  await page.goto(datasetPath)
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: "Add files" }).click()

  const dataTransfer = await page.evaluateHandle(() => {
    const transfer = new DataTransfer()
    transfer.items.add(new File(["dropped"], "dropped.csv"))
    return transfer
  })
  const zone = dialog(page).getByText("Drag files or folders here")
  await zone.dispatchEvent("dragenter", { dataTransfer })
  await zone.dispatchEvent("drop", { dataTransfer })

  await expect(
    dialog(page).getByRole("textbox", { name: "File name for dropped.csv" })
  ).toHaveValue("dropped.csv")
})

test("adds files from the processing tab", async ({ page }) => {
  await page.goto(`${datasetPath}/processing`)
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: "Add files" }).click()
  await expect(dialog(page)).toBeVisible()
})

test("keeps a failed part transfer local with per-file recovery", async ({
  page,
}) => {
  await page.route("**/fixture-uploads*", async (route) => {
    await route.abort("failed")
  })

  await page.goto(datasetPath)
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: "Add files" }).click()

  await chooseFiles(page, [
    { name: failedFilename, text: "measured potential values for cycle 05" },
  ])
  await dialog(page).getByRole("button", { name: "Upload 1 file" }).click()

  await expect(
    dialog(page).getByText("could not be transferred", { exact: false })
  ).toBeVisible({ timeout: 15000 })
  await expect(
    dialog(page).getByRole("button", { name: "Upload 1 file" })
  ).toBeEnabled()
  await expect(
    dialog(page).getByRole("button", {
      name: `Remove ${failedFilename} from the upload list`,
    })
  ).toBeEnabled()

  await expect(new AxeBuilder({ page }).analyze()).resolves.toMatchObject({
    violations: [],
  })
})
