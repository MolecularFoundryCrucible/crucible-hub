import { expect, test } from "../fixtures"

const projectMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z3"

const cases = [
  {
    destination: /\/hub\/projects(?:\?|$)/,
    field: "Title",
    path: "/hub/projects/new?scenario=populated",
  },
  {
    destination: /\/hub\/instruments(?:\?|$)/,
    field: "Name",
    path: "/hub/instruments/new?scenario=populated",
  },
  {
    destination: /\/hub\/data(?:\?|$)/,
    fieldId: "sample_name",
    path: "/hub/samples/new?scenario=populated",
  },
  {
    destination: /\/hub\/data(?:\?|$)/,
    field: "Name",
    path: "/hub/datasets/new?scenario=populated",
  },
] as const

for (const creation of cases) {
  test(`discards ${creation.path} with one confirmation`, async ({ page }) => {
    await page.goto(creation.path)
    await page.waitForLoadState("networkidle")
    const field =
      "fieldId" in creation
        ? page.locator(`#${creation.fieldId}`)
        : page.getByLabel(creation.field, { exact: true })
    await field.fill("Unsaved draft")
    await page.getByRole("button", { name: "Cancel", exact: true }).click()

    const dialog = page.getByRole("dialog", {
      name: "Discard unsaved changes?",
    })
    await expect(dialog).toBeVisible()
    await dialog.getByRole("button", { name: "Discard changes" }).click()

    await expect(page).toHaveURL(creation.destination)
    await expect(dialog).toHaveCount(0)
  })
}

test("associates project creation guidance and errors with their field", async ({
  page,
}) => {
  await page.goto("/hub/projects/new?scenario=populated")
  const projectId = page.getByLabel("Project ID")
  await projectId.fill("!!")
  await projectId.press("Tab")

  await expect(projectId).toHaveAttribute(
    "aria-describedby",
    "project-creation-project_id-description project-creation-project_id-error"
  )
})

test("creates a project and opens its canonical page", async ({ page }) => {
  await page.goto("/hub/projects/new?scenario=populated")
  await page.waitForLoadState("networkidle")
  await page.getByLabel("Title").fill("Catalyst Validation")
  await page.getByLabel("Organization").fill("Example National Laboratory")
  await page.getByLabel("Project ID").fill("catalyst-validation")
  await page.getByLabel("Project ID").press("Tab")
  await page.getByRole("button", { name: "Create project" }).click()

  await expect(page).toHaveURL(
    /\/hub\/projects\/fixture-project-catalyst-validation/
  )
  await expect(
    page.getByRole("heading", { level: 1, name: "Catalyst Validation" })
  ).toBeVisible()
})

test("registers an instrument and opens its canonical page", async ({
  page,
}) => {
  await page.goto("/hub/instruments/new?scenario=populated")
  await page.waitForLoadState("networkidle")
  await page.getByLabel("Name").fill("Soft X-ray Test Stand")
  await page.getByLabel("Instrument ID").fill("soft-xray-test")
  await page.getByLabel("Location").fill("Building 2")
  await page.getByLabel("Location").press("Tab")
  await page.getByRole("button", { name: "Register instrument" }).click()

  await expect(page).toHaveURL(/\/hub\/instruments\/fixture-instrument-/)
  await expect(
    page.getByRole("heading", { level: 1, name: "Soft X-ray Test Stand" })
  ).toBeVisible()
})

test("creates a sample in a preselected project", async ({ page }) => {
  await page.goto(
    `/hub/samples/new?scenario=populated&projectMfid=${projectMfid}`
  )
  await page.waitForLoadState("networkidle")
  await page.locator("#sample_name").fill("Reference catalyst")
  await page.locator("#sample_name").press("Tab")
  await page.getByRole("button", { name: "Create sample" }).click()

  await expect(page).toHaveURL(/\/hub\/samples\/fixture-sample-/)
  await expect(
    page.getByRole("heading", { level: 1, name: "Reference catalyst" })
  ).toBeVisible()
})

test("creates a dataset with optional details visible", async ({ page }) => {
  await page.goto(
    `/hub/datasets/new?scenario=populated&projectMfid=${projectMfid}`
  )
  await page.waitForLoadState("networkidle")
  await expect(page.getByRole("group", { name: "Acquisition" })).toBeVisible()
  await expect(page.getByLabel("Measurement")).toBeVisible()
  await page.getByLabel("Name", { exact: true }).fill("Validation scan")
  await page.getByLabel("Name", { exact: true }).press("Tab")
  await page.getByRole("button", { name: "Create dataset" }).click()

  await expect(page).toHaveURL(/\/hub\/datasets\/fixture-dataset-/)
  await expect(
    page.getByRole("heading", { level: 1, name: "Validation scan" })
  ).toBeVisible()
})
