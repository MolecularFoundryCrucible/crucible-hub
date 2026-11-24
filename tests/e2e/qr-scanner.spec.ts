import { expect, test } from "../fixtures"

test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
  hasTouch: true,
  permissions: ["camera"],
  viewport: { height: 800, width: 390 },
})

test("closes the scanner without opening search", async ({ page }) => {
  await page.goto("/hub/projects/01J6Y8N4Q2R7M9K3T5V0W1X2Z3")
  await page.waitForLoadState("networkidle")
  const scan = page.getByRole("button", { name: "Scan QR code" })
  await scan.click()
  await expect(
    page.getByRole("heading", { name: "Scan an MFID" })
  ).toBeVisible()

  await page.touchscreen.tap(10, 790)
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(scan).toBeFocused()
  await expect(page.locator('header input[role="combobox"]')).toHaveAttribute(
    "aria-expanded",
    "false"
  )
})
