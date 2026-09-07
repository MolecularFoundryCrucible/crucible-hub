import AxeBuilder from "@axe-core/playwright"

import { expect, test } from "../fixtures"

const sampleMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z5"
const restrictedSampleMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z6"
const datasetMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z7"

test("sample Access retains the resource header and manages public and direct access", async ({
  page,
}) => {
  await page.goto(`/hub/samples/${sampleMfid}?scenario=populated`)
  await page.waitForLoadState("networkidle")
  const title = page.getByRole("heading", {
    level: 1,
    name: "NiFe oxide catalyst A",
  })
  await expect(title).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Choose project" })
  ).toHaveCount(0)
  await page.getByRole("link", { name: "Access", exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/samples/${sampleMfid}/access`))
  await expect(title).toBeVisible()
  await expect(
    page
      .getByRole("navigation", { name: "Sample sections" })
      .getByRole("link", {
        name: "Access",
      })
  ).toHaveAttribute("aria-current", "page")
  await expect(
    page.getByRole("button", { name: "Choose project" })
  ).toBeVisible()
  const actionGrid = page.locator('[data-slot="content-grid"]').filter({
    has: page.getByText("Assign to project", { exact: true }),
  })
  await expect(actionGrid).toHaveCSS("display", "grid")
  const assignmentCard = actionGrid
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Assign to project", { exact: true }) })
  const ownershipCard = actionGrid
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Transfer ownership", { exact: true }) })
  await expect(assignmentCard).toBeVisible()
  await expect(ownershipCard).toBeVisible()
  expect(
    await actionGrid.evaluate(
      (grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length
    )
  ).toBe(2)

  await page.getByRole("button", { name: "Manage access" }).click()
  await page
    .getByRole("main")
    .getByRole("button", { name: "Publish", exact: true })
    .click()
  const publishDialog = page.getByRole("alertdialog", {
    name: "Publish resource?",
  })
  await expect(publishDialog).toContainText("will be available")
  await publishDialog
    .getByRole("button", { name: "Publish", exact: true })
    .click()
  await expect(publishDialog).toHaveCount(0)
  await expect(page.getByText("Public", { exact: true })).toBeVisible()

  await page
    .getByRole("main")
    .getByRole("button", { name: "Make private", exact: true })
    .click()
  const privateDialog = page.getByRole("alertdialog", {
    name: "Make resource private?",
  })
  await privateDialog
    .getByRole("button", { name: "Make private", exact: true })
    .click()
  await expect(privateDialog).toHaveCount(0)
  await expect(page.getByText("Private", { exact: true })).toBeVisible()

  const grants = page.getByRole("list", { name: "Direct access grants" })
  await expect(
    grants.locator('[data-principal-type="user"]').first()
  ).toHaveAttribute("aria-label", "Person")
  await expect(
    grants.locator('[data-principal-type="project"]').first()
  ).toHaveAttribute("aria-label", "Project")
  await grants
    .getByLabel("Role for Operando Catalyst Mapping")
    .selectOption("editor")
  await expect(
    grants.getByLabel("Role for Operando Catalyst Mapping")
  ).toHaveValue("editor")

  await page.getByRole("button", { name: "Add access" }).click()
  const addDialog = page.getByRole("dialog", { name: "Add direct access" })
  await addDialog
    .getByRole("searchbox", { name: "Search persons" })
    .fill("Jamie")
  await addDialog.getByRole("button", { name: "Search", exact: true }).click()
  await addDialog.getByRole("button", { name: /Jamie Patel/ }).click()
  await addDialog
    .getByRole("button", { name: "Add access", exact: true })
    .click()
  await expect(addDialog).toHaveCount(0)
  await expect(grants.getByText("Jamie Patel", { exact: true })).toBeVisible()

  await grants
    .getByRole("button", { name: "Revoke access for Jamie Patel" })
    .click()
  const revokeDialog = page.getByRole("alertdialog", {
    name: "Revoke access?",
  })
  await expect(revokeDialog).toContainText("will no longer have direct access")
  await revokeDialog
    .getByRole("button", { name: "Revoke access", exact: true })
    .click()
  await expect(grants.getByText("Jamie Patel", { exact: true })).toHaveCount(0)
})

test("dataset uses the shared Access workflow", async ({ page }) => {
  await page.goto(`/hub/datasets/${datasetMfid}/access?scenario=populated`)
  await page.waitForLoadState("networkidle")
  await expect(
    page.getByRole("heading", { level: 1, name: "NiFe K-edge operando series" })
  ).toBeVisible()
  await expect(
    page
      .getByRole("navigation", { name: "Dataset sections" })
      .getByRole("link", {
        name: "Access",
      })
  ).toHaveAttribute("aria-current", "page")
  await expect(
    page.getByRole("button", { name: "Manage access" })
  ).toBeVisible()
  await expect(page.getByText("Direct access", { exact: true })).toBeVisible()
})

test("sample Access previews and confirms project assignment", async ({
  page,
}) => {
  await page.goto(`/hub/samples/${sampleMfid}/access?scenario=populated`)
  await page.waitForLoadState("networkidle")

  await page.getByRole("button", { name: "Choose project" }).click()
  const chooser = page.getByRole("dialog", { name: "Choose a project" })
  await chooser.getByLabel("Search projects").fill("Porous")
  await chooser
    .getByRole("button", { name: /Porous Framework Screening/ })
    .click()

  const confirmation = page.getByRole("alertdialog", {
    name: "Assign to this project?",
  })
  await expect(confirmation).toContainText("Porous Framework Screening")
  await confirmation.getByRole("button", { name: "Confirm assignment" }).click()
  await expect(confirmation).toBeHidden()
  await expect(
    page.getByRole("link", { name: "Porous Framework Screening" })
  ).toBeVisible()
})

test("direct unauthorized Access shows unavailable without controls", async ({
  page,
}) => {
  await page.goto(
    `/hub/samples/${restrictedSampleMfid}/access?scenario=populated`
  )
  await page.waitForLoadState("networkidle")
  await expect(page.getByText("Access management is unavailable")).toBeVisible()
  await expect(page.getByRole("button", { name: "Manage access" })).toHaveCount(
    0
  )
  await expect(page.getByRole("button", { name: "Add access" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0)
})

test("compact Access is contained and accessible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/hub/datasets/${datasetMfid}/access?scenario=populated`)
  await page.waitForLoadState("networkidle")
  const cards = page
    .locator('[data-slot="content-grid"]')
    .filter({ has: page.getByText("Assign to project", { exact: true }) })
    .locator('[data-slot="card"]')
  await expect
    .poll(async () => {
      const assignment = await cards.nth(0).boundingBox()
      const ownership = await cards.nth(1).boundingBox()
      return assignment && ownership ? ownership.y > assignment.y : false
    })
    .toBe(true)
  const accessibilityResults = await new AxeBuilder({ page }).analyze()
  expect(accessibilityResults.violations).toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
})
