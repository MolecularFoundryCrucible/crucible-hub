import { expect, test } from "../fixtures"

const mfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z9"

for (const { width, qrSize, beside } of [
  { width: 360, qrSize: 112, beside: false },
  { width: 390, qrSize: 112, beside: false },
  { width: 412, qrSize: 68, beside: true },
  { width: 430, qrSize: 68, beside: true },
  { width: 480, qrSize: 112, beside: true },
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

test("copies the MFID beside it and prints from under the QR code", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`/hub/datasets/${mfid}`)
  await page.waitForLoadState("networkidle")

  const valueBox = (await page
    .getByText(mfid, { exact: true })
    .first()
    .boundingBox())!
  const copyBox = (await page
    .getByRole("button", { name: "Copy MFID" })
    .boundingBox())!
  const qrBox = (await page
    .getByRole("button", { name: "Enlarge MFID QR code" })
    .boundingBox())!
  const print = page.getByRole("button", { name: "Print", exact: true })

  await expect(page.getByRole("button", { name: "Copy MFID" })).toHaveCount(1)
  expect(copyBox.x).toBeGreaterThan(valueBox.x + valueBox.width - 1)
  expect(
    Math.abs(
      copyBox.y + copyBox.height / 2 - (valueBox.y + valueBox.height / 2)
    )
  ).toBeLessThan(4)
  await expect(print).toHaveText("Print")
  expect((await print.boundingBox())!.y).toBeGreaterThan(
    qrBox.y + qrBox.height - 1
  )
})
