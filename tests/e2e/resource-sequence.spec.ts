import { expect, test } from "../fixtures"

const sequenceButton = /^Change resource sequence/

test("steps through the default sequence and keeps it", async ({ page }) => {
  await page.goto("/hub/samples/01J6Y8N4Q2R7M9K3T5V0W1X2Z5")
  const trigger = page.getByRole("button", { name: sequenceButton })
  await expect(trigger).toContainText("in this project")
  const label = await trigger.textContent()

  await page.keyboard.press("ArrowRight")
  await expect(page).toHaveURL(/samples\/01J6Y8N4Q2R7M9K3T5V0W1X2Z6/)
  await expect(trigger).toHaveText(label!)

  await page.getByRole("button", { name: /^Previous item/ }).click()
  await expect(page).toHaveURL(/samples\/01J6Y8N4Q2R7M9K3T5V0W1X2Z5/)
  await expect(trigger).toHaveText(label!)
})
