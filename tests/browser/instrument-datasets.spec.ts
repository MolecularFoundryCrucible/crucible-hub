import AxeBuilder from "@axe-core/playwright"

import { expect, test } from "../fixtures"

const instrumentPath = "/hub/instruments/01J6Y8N4Q2R7M9K3T5V0W1X2Z4"

function isDatasetRequest(url: string) {
  return (
    url.includes("/hub/_serverFn/") &&
    decodeURIComponent(url).includes("instrumentMfid")
  )
}

test("appends instrument datasets and restores the loaded collection after detail", async ({
  page,
}) => {
  await page.goto(
    "/hub/instruments/fixture-instrument-1/datasets?scenario=dense"
  )
  await page.waitForLoadState("networkidle")
  await expect(
    page.getByRole("link", {
      name: "Dataset: Operando spectroscopy acquisition with a deliberately long descriptive name",
    })
  ).toBeVisible()
  const datasetRequests: string[] = []
  page.on("request", (request) => {
    if (isDatasetRequest(request.url())) datasetRequests.push(request.url())
  })

  await page.getByRole("button", { name: "Load more datasets" }).click()
  await expect(page).not.toHaveURL(/cursor=/)
  const dataset = page.getByRole("link", {
    name: "Dataset: Measurement dataset 51",
    exact: true,
  })
  await expect(dataset).toBeVisible()
  await expect(page.getByRole("link", { name: /^Dataset: / })).toHaveCount(54)
  await expect(
    page.getByRole("button", { name: "Load more datasets" })
  ).toHaveCount(0)
  expect(datasetRequests).toHaveLength(1)

  await dataset.click()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Measurement dataset 51"
  )
  await page.goBack()
  await expect(page).not.toHaveURL(/cursor=/)
  await expect(dataset).toBeVisible()
  expect(datasetRequests).toHaveLength(1)
})

test("shows an empty dataset section for an instrument without acquisitions", async ({
  page,
}) => {
  await page.goto(
    "/hub/instruments/fixture-instrument-3/datasets?scenario=dense"
  )
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Research instrument 3"
  )
  await expect(page.getByText(/No datasets/)).toBeVisible()
  await expect(page.getByRole("link", { name: /^Dataset: / })).toHaveCount(0)
  await expect(
    page.getByRole("navigation", { name: "Instrument sections" })
  ).toBeVisible()
})

test("loads instrument datasets on demand and restores them after detail", async ({
  page,
}) => {
  const datasetRequests: string[] = []
  page.on("request", (request) => {
    if (isDatasetRequest(request.url())) datasetRequests.push(request.url())
  })
  await page.goto(instrumentPath)
  await page.waitForLoadState("networkidle")
  const sections = page.getByRole("navigation", { name: "Instrument sections" })
  await expect(
    sections.getByRole("link", { name: "Overview" })
  ).toHaveAttribute("aria-current", "page")
  expect(datasetRequests).toHaveLength(0)

  await sections.getByRole("link", { name: "Datasets", exact: true }).click()
  const dataset = page.getByRole("link", {
    name: "Dataset: NiFe K-edge operando series",
  })
  await expect(dataset).toBeVisible()
  await expect(page).toHaveURL(`${instrumentPath}/datasets`)
  expect(datasetRequests).toHaveLength(1)
  await expect(
    sections.getByRole("link", { name: "Datasets", exact: true })
  ).toHaveAttribute("aria-current", "page")

  await dataset.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "NiFe K-edge operando series"
  )
  await page.goBack()
  await expect(page).toHaveURL(`${instrumentPath}/datasets`)
  await expect(dataset).toBeVisible()
  expect(datasetRequests).toHaveLength(1)
})

test("keeps instrument context mounted through a slow failed dataset read and retry", async ({
  page,
}) => {
  await page.goto(instrumentPath)
  await page.waitForLoadState("networkidle")
  const heading = page.getByRole("heading", { level: 1 })
  await expect(heading).toHaveText("Hard X-ray Microprobe")
  await heading.evaluate((element) => {
    element.setAttribute("data-test-retained", "true")
  })

  let releaseRequest = () => {}
  const heldRequest = new Promise<void>((resolve) => {
    releaseRequest = resolve
  })
  let failRequests = true
  await page.route("**/hub/_serverFn/**", async (route) => {
    if (!failRequests || !isDatasetRequest(route.request().url())) {
      await route.continue()
      return
    }
    await heldRequest
    await route.abort("failed")
  })

  const sections = page.getByRole("navigation", { name: "Instrument sections" })
  await sections.getByRole("link", { name: "Datasets", exact: true }).click()
  await expect(
    page.getByLabel("Loading datasets", { exact: true })
  ).toBeVisible()
  await expect(heading).toHaveAttribute("data-test-retained", "true")
  await expect(sections.getByRole("link", { name: "Overview" })).toBeVisible()
  releaseRequest()

  await expect(page.getByText("Datasets could not be loaded")).toBeVisible()
  await expect(heading).toHaveAttribute("data-test-retained", "true")
  failRequests = false
  await page.getByRole("button", { name: "Try again", exact: true }).click()
  await expect(
    page.getByRole("link", { name: "Dataset: NiFe K-edge operando series" })
  ).toBeVisible()
  await expect(heading).toHaveAttribute("data-test-retained", "true")
})

test("opens instrument datasets directly and keeps initial failures local", async ({
  page,
}) => {
  await page.goto(`${instrumentPath}/datasets?scenario=partial`)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Hard X-ray Microprobe"
  )
  await expect(page.getByText("Datasets could not be loaded")).toBeVisible()
  await page
    .getByRole("navigation", { name: "Instrument sections" })
    .getByRole("link", { name: "Overview" })
    .click()
  await expect(page.getByText("Summary", { exact: true })).toBeVisible()
})

for (const theme of ["light", "dark"] as const) {
  test(`keeps ${theme} instrument datasets accessible and within compact and laptop widths`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.addInitScript((selectedTheme) => {
      localStorage.setItem("crucible-hub-theme", selectedTheme)
    }, theme)
    await page.goto(`${instrumentPath}/datasets`)
    await page.waitForLoadState("networkidle")
    await expect(page.locator("html")).toHaveClass(new RegExp(theme))
    await expect(
      page.getByRole("link", { name: "Dataset: NiFe K-edge operando series" })
    ).toBeVisible()
    await expect(new AxeBuilder({ page }).analyze()).resolves.toMatchObject({
      violations: [],
    })
    for (const width of [320, 1024]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth
        )
      ).toBe(true)
    }
  })
}
