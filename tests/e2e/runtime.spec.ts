import { expect, test } from "../fixtures"

test("navigates projects, preview deep links, and nested instrument datasets with server functions", async ({
  page,
}) => {
  await page.goto("/hub/projects")
  await page.waitForLoadState("networkidle")
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
    .getByRole("main")
    .getByRole("link", { name: "Operando Catalyst Mapping" })
    .first()
    .click()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Operando Catalyst Mapping"
  )
  await expect(page.getByLabel("Project data type")).toBeVisible()
  expect(projectDataResponses).toHaveLength(1)
  const samplesHandler = new URL(projectDataResponses[0]!).pathname
  await page
    .getByLabel("Project data type")
    .getByRole("button", { name: "Datasets" })
    .click()
  await expect(
    page.getByRole("link", { name: /Preview NiFe K-edge/ })
  ).toBeVisible()
  expect(projectDataResponses).toHaveLength(2)
  expect(new URL(projectDataResponses[1]!).pathname).not.toBe(samplesHandler)
  const projectSections = page.getByRole("navigation", {
    name: "Project sections",
  })
  await projectSections.getByRole("link", { name: "Overview" }).click()
  await expect(page.getByText("Summary", { exact: true })).toBeVisible()
  await expect(page.getByText("People", { exact: true })).toBeVisible()

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
  await expect(
    panel.locator('[data-slot="sheet-footer"]').locator("a, button")
  ).toHaveText(["Open", "Print", "Delete"])
  await open.click()
  await expect(page).toHaveURL(
    `/hub/datasets/${dataset}?fromProject=01J6Y8N4Q2R7M9K3T5V0W1X2Z3`
  )
  await page.goBack()
  await expect(page).toHaveURL(`${collection}&preview=${dataset}`)
  await expect(panel).toBeVisible()

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

test("explains each sign-in error reason", async ({ page }) => {
  await page.goto("/hub/auth/error?reason=account-mismatch")
  await expect(
    page.getByRole("heading", { name: "A different account signed in" })
  ).toBeVisible()
  await expect(
    page.getByText("You are still signed in as before.")
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Return to Crucible Hub" })
  ).toBeVisible()

  await page.goto("/hub/auth/error?reason=stale-sign-in")
  await expect(
    page.getByRole("heading", { name: "Sign-in was not recent" })
  ).toBeVisible()
  await expect(
    page.getByText("You are still signed in as before.")
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0)

  await page.goto("/hub/auth/error?reason=unavailable")
  await expect(
    page.getByRole("heading", { name: "Sign-in is unavailable" })
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Try again" })).toHaveAttribute(
    "href",
    "/hub/auth/sign-in"
  )
})
