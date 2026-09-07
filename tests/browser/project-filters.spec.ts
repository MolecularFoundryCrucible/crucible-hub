import AxeBuilder from "@axe-core/playwright"

import { expect, test } from "../fixtures"

const projectPath = "/hub/projects/fixture-project-1"

function isProjectDataRequest(url: string) {
  const decoded = decodeURIComponent(url)
  return (
    url.includes("/hub/_serverFn/") &&
    decoded.includes("projectMfid") &&
    decoded.includes("projectScope")
  )
}

test("applies and clears creation and visibility filters without eager requests", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" })
  await page.addInitScript(() => {
    localStorage.setItem("crucible-hub-theme", "light")
  })
  await page.goto(
    `${projectPath}?scenario=dense&scope=assigned&sampleCursor=fixture%3A2&datasetCursor=fixture%3A2`
  )
  await page.waitForLoadState("networkidle")
  const successfulResponses: string[] = []
  page.on("response", (response) => {
    if (response.ok() && isProjectDataRequest(response.url())) {
      successfulResponses.push(response.url())
    }
  })

  await page
    .locator("summary")
    .filter({ hasText: /^Filters/ })
    .click()
  await expect(page.getByLabel("Relationship to this project")).toHaveValue(
    "assigned"
  )
  await page.getByLabel("Visibility").selectOption("public")
  await page.getByLabel("Created from (UTC)").fill("2026-08-27")
  await page.getByLabel("Created to (UTC)").fill("2026-08-27")
  expect(successfulResponses).toHaveLength(0)

  await page.getByRole("button", { name: "Apply filters" }).click()
  await expect(page).toHaveURL(/visibility=public/)
  await expect(page).toHaveURL(/createdFrom=2026-08-27/)
  await expect(page).toHaveURL(/createdTo=2026-08-27/)
  await expect(page).not.toHaveURL(/sampleCursor|datasetCursor|preview/)
  await expect(
    page.getByRole("link", {
      name: "Preview Nickel iron oxide catalyst with a deliberately long preparation identifier",
    })
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Preview Catalyst sample 3" })
  ).toHaveCount(0)
  await expect.poll(() => successfulResponses.length).toBe(1)
  const filteredRequest = decodeURIComponent(successfulResponses[0])
  expect(filteredRequest).toContain("visibility")
  expect(filteredRequest).toContain("public")
  expect(filteredRequest).toContain("createdFrom")
  expect(filteredRequest).toContain("2026-08-27")
  expect(filteredRequest).toContain("projectScope")
  expect(filteredRequest).toContain("assigned")

  await page.getByRole("button", { name: "Clear filters" }).click()
  await expect(page).not.toHaveURL(
    /createdFrom|createdTo|visibility|sampleCursor|datasetCursor|preview|scope/
  )
  await expect(page.getByLabel("Relationship to this project")).toHaveValue(
    "all"
  )
  await expect(page.getByLabel("Visibility")).toHaveValue("all")
  await expect(page.getByLabel("Created from (UTC)")).toHaveValue("")
  await expect(page.getByLabel("Created to (UTC)")).toHaveValue("")
})

test("confirms an instrument search without submitting the outer filter form", async ({
  page,
}) => {
  await page.goto(`${projectPath}?scenario=dense&kind=datasets&scope=assigned`)
  await page.waitForLoadState("networkidle")
  const successfulResponses: string[] = []
  page.on("response", (response) => {
    if (response.ok() && isProjectDataRequest(response.url())) {
      successfulResponses.push(response.url())
    }
  })

  await page
    .locator("summary")
    .filter({ hasText: /^Filters/ })
    .click()
  await page.getByRole("button", { name: "Choose instrument" }).click()
  const dialog = page.getByRole("dialog", {
    name: "Choose acquisition instrument",
  })
  await dialog.getByLabel("Search instruments").fill("High-resolution")
  await dialog.getByRole("button", { name: "Search", exact: true }).click()
  await expect(
    dialog.getByRole("button", {
      name: "High-resolution operando hard X-ray microprobe instrument",
    })
  ).toBeVisible()
  await expect(page).not.toHaveURL(/instrumentMfid/)
  expect(successfulResponses).toHaveLength(0)

  await dialog
    .getByRole("button", {
      name: "High-resolution operando hard X-ray microprobe instrument",
    })
    .click()
  await expect(dialog).toHaveCount(0)
  await expect(
    page.getByText(
      "High-resolution operando hard X-ray microprobe instrument",
      { exact: true }
    )
  ).toBeVisible()
  await expect(page).not.toHaveURL(/instrumentMfid/)
  expect(successfulResponses).toHaveLength(0)

  await page.getByRole("button", { name: "Apply filters" }).click()
  await expect(page).toHaveURL(/instrumentMfid=fixture-instrument-1/)
  await expect(
    page.getByRole("link", {
      name: "Preview Operando spectroscopy acquisition with a deliberately long descriptive name",
    })
  ).toBeVisible()
  await page
    .getByLabel("Project data type")
    .getByRole("link", { name: "Samples" })
    .click()
  await expect(page).not.toHaveURL(/instrumentMfid/)
  await expect(page.getByText("Acquisition instrument")).toHaveCount(0)
})

test("blocks malformed filter URLs without loading a collection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" })
  await page.addInitScript(() => {
    localStorage.setItem("crucible-hub-theme", "dark")
  })
  const collectionRequests: string[] = []
  page.on("request", (request) => {
    if (isProjectDataRequest(request.url())) {
      collectionRequests.push(request.url())
    }
  })
  const invalidSearches = [
    "createdFrom=2026-02-30",
    `kind=datasets&instrumentMfid=${encodeURIComponent(JSON.stringify({ forged: "value" }))}`,
    `kind=datasets&instrumentMfid=${"x".repeat(256)}`,
  ]

  for (const search of invalidSearches) {
    collectionRequests.length = 0
    await page.goto(`${projectPath}?scenario=dense&${search}`)
    await page.waitForLoadState("networkidle")
    await expect(
      page.getByRole("alert").filter({
        hasText: "Project data filters are not valid",
      })
    ).toBeVisible()
    expect(collectionRequests).toHaveLength(0)
  }

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

for (const theme of ["light", "dark"] as const) {
  test(`keeps outlined card actions distinct from the ${theme} surface`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme })
    await page.addInitScript((selectedTheme) => {
      localStorage.setItem("crucible-hub-theme", selectedTheme)
    }, theme)
    await page.goto("/hub/projects?scenario=populated")
    await page.waitForLoadState("networkidle")

    const action = page.getByRole("link", { name: /Open project/ }).first()
    await expect(action).toBeVisible()
    const colors = await action.evaluate((element) => {
      const card = element.closest('[data-slot="card"]')
      return {
        actionBackground: getComputedStyle(element).backgroundColor,
        actionBorder: getComputedStyle(element).borderTopColor,
        cardBackground: card ? getComputedStyle(card).backgroundColor : null,
      }
    })
    expect(colors.actionBackground).not.toBe(colors.cardBackground)
    expect(colors.actionBorder).not.toBe(colors.cardBackground)
  })
}
