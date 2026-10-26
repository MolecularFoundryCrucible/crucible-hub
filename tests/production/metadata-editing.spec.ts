import { expect, test } from "../fixtures"

for (const { path, kind } of [
  {
    kind: "project",
    path: "/hub/projects/01J6Y8N4Q2R7M9K3T5V0W1X2Z3/overview",
  },
  {
    kind: "instrument",
    path: "/hub/instruments/01J6Y8N4Q2R7M9K3T5V0W1X2Z4/overview",
  },
]) {
  test(`edits ${kind} scientific metadata`, async ({ page }) => {
    await page.goto(path)
    await page.waitForLoadState("networkidle")
    await page.getByRole("button", { name: "Edit scientific metadata" }).click()

    await expect(page.getByRole("button", { name: "Save" })).toBeVisible()
    await page.getByRole("button", { name: "Cancel" }).click()
    await expect(
      page.getByRole("button", { name: "Edit scientific metadata" })
    ).toBeVisible()
  })
}

test("links a required field's error to the field in the instrument editor", async ({
  page,
}) => {
  await page.goto("/hub/instruments/01J6Y8N4Q2R7M9K3T5V0W1X2Z4/overview")
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: "Edit instrument" }).click()
  const name = page.getByRole("textbox", { name: /^Name/ })
  await expect(name).toBeFocused()
  await name.fill("")
  await name.blur()
  await expect(name).toHaveAttribute("aria-invalid", "true")
  const errorId = await name.getAttribute("aria-errormessage")
  expect(errorId).toBeTruthy()
  await expect(page.locator(`[id="${errorId}"]`)).toBeVisible()
  await expect(name).toHaveAttribute("aria-describedby", errorId!)
  await page.getByRole("button", { name: "Cancel" }).click()
})

for (const [path, label] of [
  ["/hub/samples/new", /^Name/],
  ["/hub/datasets/new", /^Name/],
  ["/hub/projects/new", /^Title/],
  ["/hub/instruments/new", /^Name/],
] as const) {
  test(`links required field errors on ${path}`, async ({ page }) => {
    await page.goto(path)
    await page.waitForLoadState("networkidle")
    const field = page.getByRole("textbox", { name: label })
    await field.fill("x")
    await field.fill("")
    await field.blur()
    await expect(field).toHaveAttribute("aria-invalid", "true")
    const errorId = await field.getAttribute("aria-errormessage")
    expect(errorId).toBeTruthy()
    await expect(page.locator(`[id="${errorId}"]`)).not.toBeEmpty()
    await expect(field).toHaveAttribute(
      "aria-describedby",
      new RegExp(`(^| )${errorId}$`)
    )
  })
}
