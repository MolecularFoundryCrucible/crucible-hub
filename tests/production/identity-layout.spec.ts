import { expect, test } from "../fixtures"

const mfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z9"

for (const { width, qrSize, beside } of [
  { width: 360, qrSize: 112, beside: false },
  { width: 390, qrSize: 68, beside: true },
  { width: 412, qrSize: 68, beside: true },
  { width: 430, qrSize: 112, beside: true },
  { width: 600, qrSize: 112, beside: true },
]) {
  test(`keeps the MFID on one line beside a fitting QR code at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`/hub/datasets/${mfid}`)
    await page.waitForLoadState("networkidle")

    const value = page.getByText(mfid, { exact: true }).first()
    const qr = page.getByRole("button", { name: "Enlarge MFID QR code" })
    const valueBox = (await value.boundingBox())!
    const qrBox = (await qr.boundingBox())!

    expect(valueBox.height).toBeLessThan(24)
    expect(Math.round(qrBox.width)).toBe(qrSize)
    expect(qrBox.y < valueBox.y + valueBox.height).toBe(beside)
  })
}
