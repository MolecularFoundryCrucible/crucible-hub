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

test("transitions dialogs in and out with the modal motion role", async ({
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
      duration: style.transitionDuration,
      easing: style.transitionTimingFunction,
      layer: style.zIndex,
      properties: style.transitionProperty,
    }
  })
  expect(opening).toEqual({
    duration: "0.18s",
    easing: "cubic-bezier(0, 0, 0.2, 1)",
    layer: "40",
    properties: "opacity, scale",
  })

  await page.keyboard.press("Escape")
  const closing = await dialog.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      duration: style.transitionDuration,
      easing: style.transitionTimingFunction,
    }
  })
  expect(closing).toEqual({
    duration: "0.12s",
    easing: "cubic-bezier(0.4, 0, 1, 1)",
  })
  await expect(dialog).toBeHidden()
})

test("keeps staged members while the dialog closes", async ({ page }) => {
  await page.goto(managePath)
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: "Manage access" }).click()
  await page.getByRole("button", { name: "Add access" }).click()
  const dialog = page.getByRole("dialog", { name: "Add direct access" })
  const input = dialog.getByRole("combobox", { name: "Search people" })
  await input.click()
  await input.pressSequentially("jam")
  await page
    .getByRole("option", { name: /Jamie Patel/i })
    .first()
    .click()
  await expect(
    dialog.getByRole("list", { name: "Members to add" })
  ).toContainText("Jamie Patel")

  await dialog.getByRole("button", { name: "Cancel" }).click()
  const duringExit = await dialog.evaluate((element) => ({
    closing: element.hasAttribute("data-ending-style"),
    staged: element.textContent.includes("Jamie Patel"),
  }))
  expect(duringExit).toEqual({ closing: true, staged: true })
  await expect(dialog).toBeHidden()
})

test("shows the QR scanner tooltip to keyboard users", async ({ page }) => {
  await page.goto("/hub/")
  await page.waitForLoadState("networkidle")
  const scan = page.getByRole("button", { name: "Scan QR code" })
  await page
    .getByRole("combobox", { name: /search/i })
    .first()
    .focus()
  for (let step = 0; step < 6; step += 1) {
    if (await scan.evaluate((element) => element === document.activeElement))
      break
    await page.keyboard.press("Tab")
  }
  await expect(scan).toBeFocused()
  await expect(page.locator("[data-slot=tooltip-content]")).toHaveText(
    "Scan QR code"
  )
})

test("transitions menus so a quick close reverses smoothly", async ({
  page,
}) => {
  await page.goto("/hub/")
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: "Create" }).click()
  const menu = page.getByRole("menu")
  await expect(menu).toBeVisible()
  const style = await menu.evaluate((element) => {
    const computed = getComputedStyle(element)
    return {
      duration: computed.transitionDuration,
      properties: computed.transitionProperty,
    }
  })
  expect(style).toEqual({
    duration: "0.12s",
    properties: "opacity, scale, translate",
  })
})
