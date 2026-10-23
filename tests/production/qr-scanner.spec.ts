import { expect, test } from "../fixtures"

test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
  permissions: ["camera"],
  viewport: { height: 800, width: 390 },
})

test("frames the scan region in a square viewfinder", async ({ page }) => {
  await page.goto("/hub/?scenario=populated")
  await page.waitForLoadState("networkidle")
  const glyphWidth = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((element) => element.getBoundingClientRect().width)
  expect(await glyphWidth('header [aria-label="Scan QR code"] svg')).toBe(
    await glyphWidth('header [data-slot="input-group"] svg')
  )
  await page.getByRole("button", { name: "Scan QR code" }).click()
  await expect(
    page.getByRole("heading", { name: "Scan an MFID" })
  ).toBeVisible()
  await expect(page.getByText("Requesting camera access...")).toHaveCount(0)

  const viewfinder = (await page.locator(".qr-viewfinder").boundingBox())!
  const frame = (await page.locator(".qr-viewfinder-frame").boundingBox())!
  expect(Math.abs(viewfinder.width - viewfinder.height)).toBeLessThan(1)
  expect(viewfinder.width).toBeGreaterThan(300)
  expect(Math.abs(frame.x - viewfinder.x - viewfinder.width / 6)).toBeLessThan(
    1
  )
  expect(Math.abs(frame.width - (viewfinder.width * 2) / 3)).toBeLessThan(1)
  await expect(page.locator(".qr-viewfinder-frame")).toHaveCSS(
    "color",
    "rgb(255, 102, 0)"
  )
})
