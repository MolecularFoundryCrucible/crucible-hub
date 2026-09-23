import AxeBuilder from "@axe-core/playwright"

import { expect, test } from "../fixtures"

const sampleMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z5"
const datasetMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z7"

function serverFunctionPost(request: {
  method: () => string
  url: () => string
}) {
  return (
    request.method() === "POST" && request.url().includes("/hub/_serverFn/")
  )
}

test("submits a reviewed sample deletion request without calling a live API", async ({
  page,
}) => {
  const mutationRequests: string[] = []
  const liveApiRequests: string[] = []
  page.on("request", (request) => {
    if (serverFunctionPost(request)) mutationRequests.push(request.url())
    if (/crucible\.lbl\.gov|testapi|staging/i.test(request.url())) {
      liveApiRequests.push(request.url())
    }
  })

  await page.goto(`/hub/samples/${sampleMfid}/manage?scenario=populated`)
  await page.waitForLoadState("networkidle")
  await page
    .getByRole("button", {
      name: "Request deletion of NiFe oxide catalyst A",
      exact: true,
    })
    .click()

  const dialog = page.getByRole("dialog")
  await expect(
    dialog.getByRole("heading", { name: "Request deletion?" })
  ).toBeVisible()
  await expect(dialog).toContainText("submits NiFe oxide catalyst A for review")
  await dialog.getByLabel("Reason").fill("Duplicate sample record")
  await dialog
    .getByRole("button", { name: "Submit deletion request", exact: true })
    .click()

  await expect(dialog).toHaveCount(0)
  await expect(
    page.getByRole("button", {
      name: "Deletion request pending",
      exact: true,
    })
  ).toBeVisible()
  expect(mutationRequests).toHaveLength(1)
  expect(liveApiRequests).toEqual([])
})

test("submits a dataset deletion request without requiring a reason", async ({
  page,
}) => {
  await page.goto(`/hub/datasets/${datasetMfid}/manage?scenario=populated`)
  await page.waitForLoadState("networkidle")
  await page
    .getByRole("button", {
      name: "Request deletion of NiFe K-edge operando series",
      exact: true,
    })
    .click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Submit deletion request", exact: true })
    .click()

  await expect(
    page.getByRole("button", {
      name: "Deletion request pending",
      exact: true,
    })
  ).toBeVisible()
})

test("retains the deletion reason when submission fails", async ({ page }) => {
  await page.goto(`/hub/samples/${sampleMfid}/manage?scenario=populated`)
  await page.waitForLoadState("networkidle")
  await page
    .getByRole("button", {
      name: "Request deletion of NiFe oxide catalyst A",
      exact: true,
    })
    .click()

  const dialog = page.getByRole("dialog")
  const reason = dialog.getByLabel("Reason")
  await reason.fill("Retain this explanation")
  let failed = false
  await page.route("**/hub/_serverFn/**", async (route) => {
    if (!failed && serverFunctionPost(route.request())) {
      failed = true
      await route.abort("failed")
      return
    }
    await route.continue()
  })
  await dialog
    .getByRole("button", { name: "Submit deletion request", exact: true })
    .click()

  await expect(dialog.getByRole("alert")).toHaveText(
    "The deletion request could not be submitted. Your reason is still here."
  )
  await expect(reason).toHaveValue("Retain this explanation")
})

test("keeps the compact dark deletion dialog accessible and contained", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: "dark" })
  await page.goto(`/hub/samples/${sampleMfid}/manage?scenario=populated`)
  await page.waitForLoadState("networkidle")
  await page
    .getByRole("button", {
      name: "Request deletion of NiFe oxide catalyst A",
      exact: true,
    })
    .click()

  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await expect(page.locator('[data-slot="tooltip-content"]')).toHaveCount(0)
  const violations = await new AxeBuilder({ page }).analyze()
  expect(violations.violations).toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
})
