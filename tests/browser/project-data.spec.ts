import { expect, test } from "../fixtures"

const projectPath = "/hub/projects/fixture-project-1"

function isProjectDataRequest(url: string) {
  return (
    url.includes("/hub/_serverFn/") &&
    decodeURIComponent(url).includes("projectMfid")
  )
}

test("consolidates read-only people and access into Overview", async ({
  page,
}) => {
  await page.goto(`${projectPath}/overview?scenario=dense`)
  await page.waitForLoadState("networkidle")

  await expect(
    page.getByRole("link", { name: "Members", exact: true })
  ).toHaveCount(0)
  await expect(page.getByText("People", { exact: true })).toBeVisible()
  await expect(page.getByText("Project details", { exact: true })).toBeVisible()
  await expect(
    page.getByText("Scientific metadata", { exact: true })
  ).toBeVisible()
  await expect(
    page.getByText("electrocatalysis", { exact: true })
  ).toBeVisible()
  await expect(page.getByText("Project ID", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Manage members", exact: true })
  ).toHaveAttribute("href", new RegExp(`${projectPath}/settings/members`))
  await expect(page.getByRole("link", { name: "Avery Chen" })).toHaveCount(2)
  await expect(page.getByText("Owner", { exact: true })).toBeVisible()
  await expect(
    page.getByText("Service account", { exact: false })
  ).toBeVisible()
  await page.goto(`${projectPath}/members?scenario=dense`)
  await expect(page).toHaveURL(
    new RegExp(`${projectPath}/overview\\?scenario=dense`)
  )
})

test("loads only the selected project data family and resets cursors with filters", async ({
  page,
}) => {
  await page.goto(`${projectPath}/overview?scenario=dense`)
  await page.waitForLoadState("networkidle")
  const requests: string[] = []
  const successfulResponses: string[] = []
  page.on("request", (request) => {
    if (isProjectDataRequest(request.url())) requests.push(request.url())
  })
  page.on("response", (response) => {
    if (response.ok() && isProjectDataRequest(response.url())) {
      successfulResponses.push(response.url())
    }
  })

  await page
    .getByRole("navigation", { name: "Project sections" })
    .getByRole("link", { name: "Data" })
    .click()
  await expect(
    page.getByRole("link", {
      name: "Preview Nickel iron oxide catalyst with a deliberately long preparation identifier",
    })
  ).toBeVisible()
  await expect(
    page.getByLabel("Project data type").locator('[aria-current="page"]')
  ).toHaveText("Samples")
  await expect(page.getByLabel("Relationship to this project")).toHaveValue(
    "all"
  )
  expect(requests).toHaveLength(1)

  await page
    .locator("summary")
    .filter({ hasText: /^Filters/ })
    .click()
  await page.getByLabel("Relationship to this project").selectOption("shared")
  expect(requests).toHaveLength(1)
  await page.getByRole("button", { name: "Apply filters" }).click()
  await expect(page).toHaveURL(/scope=shared/)
  await expect(
    page.getByRole("link", { name: "Preview Catalyst sample 2" })
  ).toBeVisible()
  expect(requests).toHaveLength(2)

  const requestsBeforeDatasets = requests.length
  const responsesBeforeDatasets = successfulResponses.length
  await page
    .getByLabel("Project data type")
    .getByRole("link", { name: "Datasets" })
    .click()
  await expect(page).toHaveURL(/kind=datasets/)
  await expect(
    page.getByRole("link", { name: "Preview Measurement dataset 2" })
  ).toBeVisible()
  await expect(
    page.getByLabel("Project data type").locator('[aria-current="page"]')
  ).toHaveText("Datasets")
  await expect(page.getByLabel("Relationship to this project")).toHaveValue(
    "shared"
  )
  const datasetRequests = requests.slice(requestsBeforeDatasets)
  expect(datasetRequests.length).toBeGreaterThan(0)
  const sampleHandler = new URL(requests[0]).pathname
  expect(
    datasetRequests.every((url) => new URL(url).pathname !== sampleHandler)
  ).toBe(true)
  const datasetResponses = successfulResponses.slice(responsesBeforeDatasets)
  expect(datasetResponses).toHaveLength(1)
  expect(new URL(datasetResponses[0]).pathname).not.toBe(sampleHandler)

  await page.goto(
    `${projectPath}?scenario=dense&kind=datasets&scope=shared&sampleCursor=fixture%3A50&datasetCursor=fixture%3A50`
  )
  await page
    .locator("summary")
    .filter({ hasText: /^Filters/ })
    .click()
  await page.getByLabel("Relationship to this project").selectOption("assigned")
  await page.getByRole("button", { name: "Apply filters" }).click()
  await expect(page).not.toHaveURL(/sampleCursor|datasetCursor/)
})

test("shows shared resource project context and restores it after canonical navigation", async ({
  page,
}) => {
  await page.goto(`${projectPath}?scenario=dense&scope=shared`)
  const sharedProjectRow = page.getByRole("row").filter({
    has: page.getByRole("link", { name: "Preview Catalyst sample 2" }),
  })
  await expect(
    page.getByRole("columnheader", { name: "Relation", exact: true })
  ).toHaveCount(0)
  await expect(
    sharedProjectRow.getByRole("link", {
      name: "Catalysis research project 2",
    })
  ).toBeVisible()
  await expect(
    page
      .getByRole("row")
      .filter({
        has: page.getByRole("link", { name: "Preview Catalyst sample 3" }),
      })
      .getByText("Project unavailable")
  ).toBeVisible()

  await sharedProjectRow
    .getByRole("link", { name: "Catalysis research project 2" })
    .click()
  await expect(page).toHaveURL(/\/hub\/projects\/fixture-project-2/)
  await page.goBack()
  await expect(page).toHaveURL(/scope=shared/)
  await sharedProjectRow
    .getByRole("link", { name: "Preview Catalyst sample 2" })
    .click()
  await expect(page).toHaveURL(/preview=fixture-sample-2/)
  await page
    .getByRole("dialog")
    .getByRole("link", {
      name: "Open full page: Catalyst sample 2",
      exact: true,
    })
    .click()
  await expect(page).toHaveURL(/\/hub\/samples\/fixture-sample-2/)
  await page.goBack()
  await expect(page).toHaveURL(/scope=shared/)
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(sharedProjectRow).toBeVisible()
})

test("keeps the project header through a local data failure and retry", async ({
  page,
}) => {
  await page.goto(`${projectPath}/overview?scenario=dense`)
  await page.waitForLoadState("networkidle")
  const heading = page.getByRole("heading", { level: 1 })
  await expect(heading).toHaveText(
    "A deliberately long project title for validating dense desktop layouts"
  )
  await heading.evaluate((element) =>
    element.setAttribute("data-test-retained", "true")
  )

  let releaseRequest = () => {}
  const heldRequest = new Promise<void>((resolve) => {
    releaseRequest = resolve
  })
  let failRequests = true
  await page.route("**/hub/_serverFn/**", async (route) => {
    if (!failRequests || !isProjectDataRequest(route.request().url())) {
      await route.continue()
      return
    }
    await heldRequest
    await route.abort("failed")
  })

  await page
    .getByRole("navigation", { name: "Project sections" })
    .getByRole("link", { name: "Data" })
    .click()
  await expect(page.getByLabel("Loading project data")).toBeVisible()
  await expect(heading).toHaveAttribute("data-test-retained", "true")
  releaseRequest()
  await expect(page.getByText("Project data could not be loaded.")).toBeVisible(
    {
      timeout: 15_000,
    }
  )
  await expect(heading).toHaveAttribute("data-test-retained", "true")

  failRequests = false
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(
    page.getByRole("link", {
      name: "Preview Nickel iron oxide catalyst with a deliberately long preparation identifier",
    })
  ).toBeVisible()
  await expect(heading).toHaveAttribute("data-test-retained", "true")
})
