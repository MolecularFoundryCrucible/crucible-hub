import AxeBuilder from "@axe-core/playwright"

import { expect, test } from "../fixtures"

function isCollectionRequest(url: string) {
  return (
    url.includes("/hub/_serverFn/") &&
    decodeURIComponent(url).includes('"k":["cursor","limit"')
  )
}

test("applies project, relationship, visibility, date, and instrument filters before pagination", async ({
  page,
}) => {
  await page.goto(
    "/hub/data?scenario=dense&kind=datasets&sampleCursor=fixture%3A2&datasetCursor=fixture%3A2"
  )
  await page.waitForLoadState("networkidle")
  const collectionRequests: string[] = []
  page.on("request", (request) => {
    if (isCollectionRequest(request.url())) {
      collectionRequests.push(decodeURIComponent(request.url()))
    }
  })

  await page.getByRole("button", { name: /^Filters/ }).click()
  await expect(page.getByLabel("Relationship to this project")).toHaveCount(0)
  await page.getByRole("button", { name: "Choose project" }).click()
  const projectDialog = page.getByRole("dialog", { name: "Choose project" })
  await projectDialog
    .getByRole("searchbox", { name: "Search projects" })
    .fill("deliberately long")
  await projectDialog.getByRole("button", { name: "Search" }).click()
  await projectDialog
    .getByRole("button", {
      name: "Select project: A deliberately long project title for validating dense desktop layouts",
    })
    .click()

  await expect(page.getByLabel("Relationship to this project")).toHaveValue(
    "all"
  )
  await page.getByLabel("Relationship to this project").selectOption("shared")
  await page.getByLabel("Visibility").selectOption("public")
  await page.getByLabel("Created from (UTC)").fill("2026-08-30")
  await page.getByLabel("Created to (UTC)").fill("2026-08-30")
  await page.getByRole("button", { name: "Choose instrument" }).click()
  const instrumentDialog = page.getByRole("dialog", {
    name: "Choose instrument",
  })
  await instrumentDialog
    .getByRole("searchbox", { name: "Search instruments" })
    .fill("High-resolution")
  await instrumentDialog.getByRole("button", { name: "Search" }).click()
  await instrumentDialog
    .getByRole("button", {
      name: "Select instrument: High-resolution operando hard X-ray microprobe instrument",
    })
    .click()
  expect(collectionRequests).toHaveLength(0)
  await expect(page).not.toHaveURL(/projectMfid|instrumentMfid|visibility/)

  await page.getByRole("button", { name: "Apply filters" }).click()
  await expect(page).toHaveURL(/projectMfid=fixture-project-1/)
  await expect(page).toHaveURL(/projectScope=shared/)
  await expect(page).toHaveURL(/visibility=public/)
  await expect(page).toHaveURL(/createdFrom=2026-08-30/)
  await expect(page).toHaveURL(/createdTo=2026-08-30/)
  await expect(page).toHaveURL(/instrumentMfid=fixture-instrument-1/)
  await expect(page).not.toHaveURL(/sampleCursor|datasetCursor/)
  await expect(
    page.getByRole("link", { name: "Preview Measurement dataset 3" })
  ).toBeVisible()
  await expect.poll(() => collectionRequests.length).toBe(1)
  expect(collectionRequests[0]).toContain('"projectMfid"')
  expect(collectionRequests[0]).toContain('"s":"fixture-project-1"')
  expect(collectionRequests[0]).toContain('"projectScope"')
  expect(collectionRequests[0]).toContain('"s":"shared"')
  expect(collectionRequests[0]).toContain('"visibility"')
  expect(collectionRequests[0]).toContain('"s":"public"')
  expect(collectionRequests[0]).toContain('"createdFrom"')
  expect(collectionRequests[0]).toContain('"createdTo"')
  expect(collectionRequests[0]).toContain('"s":"2026-08-30"')
  expect(collectionRequests[0]).toContain('"instrumentMfid"')
  expect(collectionRequests[0]).toContain('"s":"fixture-instrument-1"')

  await page.getByRole("link", { name: "Samples", exact: true }).click()
  await expect(page).toHaveURL(/kind=samples/)
  await expect(page).not.toHaveURL(/instrumentMfid|sampleCursor|datasetCursor/)
  await expect(page).toHaveURL(/projectMfid=fixture-project-1/)
  await expect(page.getByText("Acquisition instrument")).toHaveCount(0)

  await page.getByRole("button", { name: /^Filters/ }).click()
  await page.getByRole("button", { name: "Clear filters" }).click()
  await expect(page).toHaveURL(/kind=samples/)
  await expect(page).not.toHaveURL(
    /projectMfid|projectScope|visibility|createdFrom|createdTo|instrumentMfid|sampleCursor|datasetCursor/
  )
})

test("keeps malformed global Data filters local and corrective", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" })
  await page.addInitScript(() => {
    localStorage.setItem("crucible-hub-theme", "dark")
  })
  const collectionRequests: string[] = []
  page.on("request", (request) => {
    if (isCollectionRequest(request.url())) {
      collectionRequests.push(request.url())
    }
  })

  for (const search of [
    "projectScope=shared",
    "kind=samples&instrumentMfid=fixture-instrument-1",
    "createdFrom=2026-02-30",
  ]) {
    collectionRequests.length = 0
    await page.goto(`/hub/data?scenario=dense&${search}`)
    await page.waitForLoadState("networkidle")
    await expect(
      page.getByRole("alert").filter({ hasText: "Data filters are not valid" })
    ).toBeVisible()
    expect(collectionRequests).toHaveLength(0)
  }

  await page.getByRole("button", { name: "Clear filters" }).click()
  await expect(page).not.toHaveURL(/createdFrom/)
  await expect(
    page.getByRole("heading", { name: "Samples and datasets" })
  ).toBeVisible()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await expect(new AxeBuilder({ page }).analyze()).resolves.toMatchObject({
    violations: [],
  })
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
    )
    .toBe(true)
})
