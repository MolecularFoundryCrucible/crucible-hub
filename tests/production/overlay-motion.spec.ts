import { expect, test } from "../fixtures"

const managePath =
  "/hub/datasets/01J6Y8N4Q2R7M9K3T5V0W1X2Z7/manage?scenario=populated"

test("opens a picker above the dialog it belongs to", async ({ page }) => {
  await page.goto(managePath)
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: "Manage access" }).click()
  await page.getByRole("button", { name: "Add access" }).click()

  const dialog = page.getByRole("dialog", { name: "Add direct access" })
  const input = dialog.getByRole("combobox", { name: "Search people" })
  await input.click()
  await input.pressSequentially("jam")

  const option = page.getByRole("option", { name: /Jamie Patel/i }).first()
  await expect(option).toBeVisible()
  const box = (await option.boundingBox())!
  const topmostIsOption = await page.evaluate(
    ({ x, y }) =>
      Boolean(document.elementFromPoint(x, y)?.closest("[role=option]")),
    { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  )
  expect(topmostIsOption).toBe(true)
})

test("animates dialogs in and out with the modal motion role", async ({
  page,
}) => {
  await page.goto(managePath)
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: "Manage access" }).click()
  await page.getByRole("button", { name: "Add access" }).click()
  const dialog = page.getByRole("dialog", { name: "Add direct access" })
  await expect(dialog).toBeVisible()

  const opening = await dialog.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      duration: style.animationDuration,
      easing: style.animationTimingFunction,
      layer: style.zIndex,
    }
  })
  expect(opening).toEqual({
    duration: "0.18s",
    easing: "cubic-bezier(0, 0, 0.2, 1)",
    layer: "40",
  })

  await page.keyboard.press("Escape")
  const closing = await dialog.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      duration: style.animationDuration,
      easing: style.animationTimingFunction,
    }
  })
  expect(closing).toEqual({
    duration: "0.12s",
    easing: "cubic-bezier(0.4, 0, 1, 1)",
  })
  await expect(dialog).toBeHidden()
})
