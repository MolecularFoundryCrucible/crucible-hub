import { describe, expect, it } from "vitest"

import { dayEndUtc, dayStartUtc, isValidTimeZone } from "./time-zone"

describe("local calendar days as UTC bounds", () => {
  it("uses the viewer's zone, including daylight saving changes", () => {
    expect(dayStartUtc("2026-10-18", "America/Los_Angeles")).toBe(
      "2026-10-18T07:00:00.000Z"
    )
    expect(dayEndUtc("2026-10-18", "America/Los_Angeles")).toBe(
      "2026-10-19T06:59:59.999999Z"
    )
    expect(dayStartUtc("2026-12-01", "America/Los_Angeles")).toBe(
      "2026-12-01T08:00:00.000Z"
    )
    expect(dayEndUtc("2026-11-01", "America/Los_Angeles")).toBe(
      "2026-11-02T07:59:59.999999Z"
    )
    expect(dayStartUtc("2026-10-18", "Asia/Kolkata")).toBe(
      "2026-10-17T18:30:00.000Z"
    )
  })

  it("keeps UTC days unchanged and rolls over month ends", () => {
    expect(dayStartUtc("2026-08-27", "UTC")).toBe("2026-08-27T00:00:00.000Z")
    expect(dayEndUtc("2026-08-31", "UTC")).toBe("2026-08-31T23:59:59.999999Z")
  })

  it("accepts only real IANA zones", () => {
    expect(isValidTimeZone("Europe/Zurich")).toBe(true)
    expect(isValidTimeZone("Mars/Olympus")).toBe(false)
    expect(isValidTimeZone("")).toBe(false)
  })
})
