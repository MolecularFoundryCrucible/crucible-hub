import AxeBuilder from "@axe-core/playwright"

import { expect, test } from "../fixtures"

test("opens profile management from the account avatar and saves changes", async ({
  page,
}) => {
  const mutationRequests: string[] = []
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes("/hub/_serverFn/")
    ) {
      mutationRequests.push(request.url())
    }
  })

  await page.goto("/hub/?scenario=populated")
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: "Open account menu" }).click()
  await page.getByRole("menuitem", { name: "My profile" }).click()

  await expect(page).toHaveURL(/\/hub\/account\?scenario=populated/)
  await expect(
    page.getByRole("heading", { level: 1, name: "My profile" })
  ).toBeVisible()
  await expect(page.getByLabel("First name")).toHaveCount(0)
  await expect(page.getByText("avery.chen@example.invalid")).toBeVisible()
  await page.getByRole("button", { name: "Edit profile" }).click()
  await expect(page.getByLabel("First name")).toHaveValue("Avery")
  await expect(page.getByLabel("Email")).toHaveValue(
    "avery.chen@example.invalid"
  )

  await page.getByLabel("First name").fill("Averie")
  await page.getByLabel("Username").fill("averie_chen")
  await page.getByRole("button", { name: "Save changes" }).click()

  await expect(page.getByText("Profile saved.")).toBeVisible()
  await expect(page.getByText("Averie Chen")).toHaveCount(2)
  await expect(
    page.getByRole("button", { name: "Open account menu" })
  ).toContainText("averie_chen")
  expect(mutationRequests).toHaveLength(1)
})

test("validates profile fields and protects unsaved changes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 720, height: 900 })
  await page.goto("/hub/account?scenario=populated")
  await page.waitForLoadState("networkidle")

  await page.getByRole("button", { name: "Edit profile" }).click()
  await page.getByLabel("Username").fill("Invalid username")
  await expect(
    page.getByText(
      "Start with a lowercase letter and use lowercase letters, numbers, dots, hyphens, or underscores."
    )
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Save changes" })
  ).toBeDisabled()

  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

  await page.getByRole("button", { name: "Toggle primary navigation" }).click()
  await page
    .getByRole("dialog", { name: "Sidebar" })
    .getByRole("link", { name: "Home" })
    .click()
  const discardDialog = page.getByRole("dialog", {
    name: "Discard unsaved changes?",
  })
  await expect(discardDialog).toBeVisible()
  await discardDialog.getByRole("button", { name: "Discard changes" }).click()
  await expect(page).toHaveURL(/\/hub\/\?scenario=populated/)
})
