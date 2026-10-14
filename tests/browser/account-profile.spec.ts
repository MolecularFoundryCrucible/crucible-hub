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
  const accountMenu = page.getByRole("button", { name: "Open account menu" })
  const profileAction = page.getByRole("menuitem", { name: "My profile" })
  await expect(accountMenu).toBeEnabled()
  await expect
    .poll(async () => {
      if (await profileAction.isVisible()) return true
      await accountMenu.click()
      return profileAction.isVisible()
    })
    .toBe(true)
  await profileAction.click()

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

  const nameHint = page.getByText(
    "Add your name so collaborators can recognize you."
  )
  await expect(nameHint).toHaveCount(0)
  await page.getByLabel("First name").fill("")
  await page.getByLabel("Last name").fill("")
  await expect(nameHint).toBeVisible()
  await page.getByLabel("Last name").fill("Chen")
  await expect(nameHint).toHaveCount(0)

  await page.getByLabel("First name").fill("Averie")
  await page.getByLabel("Username").fill("averie_chen")
  await page.getByRole("button", { name: "Save changes" }).click()

  await expect(page.getByText("Profile saved")).toBeVisible()
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
      "Start with a lowercase letter and use lowercase letters, numbers, hyphens, or underscores."
    )
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Save changes" })
  ).toBeDisabled()

  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

  await page.getByRole("button", { name: "Expand navigation" }).click()
  await page
    .getByRole("dialog", { name: "Sidebar" })
    .getByRole("link", { name: "Home", exact: true })
    .click()
  const discardDialog = page.getByRole("alertdialog", {
    name: "Discard unsaved changes?",
  })
  await expect(discardDialog).toBeVisible()
  await discardDialog.getByRole("button", { name: "Discard changes" }).click()
  await expect(page).toHaveURL(/\/hub\/\?scenario=populated/)
})

test("validates service account usernames before creating", async ({
  page,
}) => {
  await page.goto("/hub/admin/service-accounts")
  await expect(page.getByText("Administrator view is off")).toBeVisible()
  const createLink = page.getByRole("link", { name: "Create service account" })
  await expect(async () => {
    if (!(await createLink.isVisible())) {
      await page
        .getByRole("button", { name: "Turn on administrator view" })
        .click({ timeout: 2000 })
    }
    await expect(createLink).toBeVisible({ timeout: 2000 })
  }).toPass({ timeout: 20000 })
  await createLink.click()
  const dialog = page.getByRole("dialog", { name: "Create service account" })
  const username = dialog.getByRole("textbox", { name: "Username" })
  const create = dialog.getByRole("button", { name: "Create service account" })

  await username.fill("a".repeat(30))
  await expect(username).toHaveValue("a".repeat(24))

  await username.fill("Beamline Uploader")
  await expect(
    dialog.getByText(
      "Start with a lowercase letter and use lowercase letters, numbers, hyphens, or underscores."
    )
  ).toBeVisible()

  await username.fill("beamline-collector")
  await expect(
    dialog.getByText(/already taken|is taken|not available/i).first()
  ).toBeVisible({
    timeout: 10000,
  })
  await expect(create).toBeDisabled()

  await username.fill("beamline-uploader-7")
  await expect(create).toBeEnabled()
})
