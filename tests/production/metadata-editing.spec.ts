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
    await page.getByRole("button", { name: "Edit scientific metadata" }).click()

    await expect(page.getByRole("button", { name: "Save" })).toBeVisible()
    await page.getByRole("button", { name: "Cancel" }).click()
    await expect(
      page.getByRole("button", { name: "Edit scientific metadata" })
    ).toBeVisible()
  })
}
