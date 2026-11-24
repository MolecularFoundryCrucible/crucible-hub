import type { Page } from "@playwright/test"

import { expect, test } from "../fixtures"
import { analyzeAccessibility } from "../accessibility"

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

test.describe.configure({ mode: "serial" })

test.beforeEach(async ({ page }) => {
  await page.route("**/fixture-uploads*", (route) =>
    route.fulfill({ headers: { "cache-control": "no-store" }, status: 200 })
  )
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
  await expect(dialog(page).getByText(/^fixture-file-/)).toHaveCount(2)
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

  await expect(analyzeAccessibility(page)).resolves.toMatchObject({
    violations: [],
  })
})

test("replaces an existing file only after explicit confirmation", async ({
  page,
}) => {
  const filename = `operando-cycle-08-${runId}.h5`
  await page.goto(datasetPath)
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: "Add files" }).click()
  await chooseFiles(page, [{ name: filename, text: "first version" }])
  await dialog(page).getByRole("button", { name: "Upload 1 file" }).click()
  await expect(dialog(page).getByText(/^fixture-file-/)).toHaveCount(1, {
    timeout: 15000,
  })
  const firstMfid = await dialog(page)
    .getByText(/^fixture-file-/)
    .innerText()
  await dialog(page).getByRole("button", { name: "Done" }).click()

  await page.getByRole("button", { name: "Add files" }).click()
  await chooseFiles(page, [
    { name: filename, text: "second, longer version of the file" },
  ])
  await expect(
    dialog(page).getByText("A file with this name is already in the dataset.")
  ).toBeVisible()
  await expect(
    dialog(page).getByRole("button", { name: "Upload 1 file" })
  ).toBeDisabled()

  await dialog(page)
    .getByRole("button", { name: `Replace the existing ${filename}` })
    .click()
  await expect(
    dialog(page).getByText(/Replaces the existing file/)
  ).toBeVisible()
  await dialog(page)
    .getByRole("button", { name: `Keep the existing ${filename}` })
    .click()
  await expect(
    dialog(page).getByText("A file with this name is already in the dataset.")
  ).toBeVisible()
  await dialog(page)
    .getByRole("button", { name: `Replace the existing ${filename}` })
    .click()

  await dialog(page).getByRole("button", { name: "Upload 1 file" }).click()
  await expect(dialog(page).getByText("· Replaced existing file")).toBeVisible({
    timeout: 15000,
  })
  await expect(dialog(page).getByText(firstMfid)).toBeVisible()
  await dialog(page).getByRole("button", { name: "Done" }).click()
  await expect(page.getByRole("row").filter({ hasText: filename })).toHaveCount(
    1
  )
})

test("opens the created dataset after uploading its files without a leave prompt", async ({
  page,
}) => {
  await page.goto("/hub/datasets/new")
  await page.waitForLoadState("networkidle")
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill(`Created with files ${runId}`)
  await page.getByLabel("Files to upload").setInputFiles({
    buffer: Buffer.from("created alongside the dataset"),
    mimeType: "application/octet-stream",
    name: `created-${runId}.h5`,
  })
  await page
    .getByRole("main")
    .getByRole("button", { name: "Create", exact: true })
    .click()

  await expect(page).toHaveURL(/\/hub\/datasets\/(?!new)[^/?]+/)
  await expect(page.getByRole("alertdialog")).toHaveCount(0)
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(
    page.getByRole("row").filter({ hasText: `created-${runId}.h5` })
  ).toBeVisible()
})
