import { describe, expect, it } from "vitest"

import {
  formatLocalDateTime,
  isValidLocalDateTime,
  localDateTimeToUtc,
  timestampToLocalInput,
} from "./format"

describe("local date and time formatting", () => {
  it("round-trips an API UTC timestamp through a local picker value", () => {
    const timestamp = "2026-09-05T19:42:18.000Z"
    expect(localDateTimeToUtc(timestampToLocalInput(timestamp))).toBe(timestamp)
  })

  it("maps an empty picker to a null API timestamp", () => {
    expect(localDateTimeToUtc("")).toBeNull()
  })

  it("rejects invalid and normalized local wall times", () => {
    expect(isValidLocalDateTime("2026-02-30T12:00:00")).toBe(false)
    expect(isValidLocalDateTime("not-a-time")).toBe(false)
    expect(() => localDateTimeToUtc("2026-02-30T12:00:00")).toThrow(RangeError)
  })

  it("formats the stored instant with local date, time, and timezone", () => {
    expect(formatLocalDateTime("2026-09-05T19:42:18.000Z")).toBe(
      new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        month: "short",
        second: "2-digit",
        timeZoneName: "short",
        year: "numeric",
      }).format(new Date("2026-09-05T19:42:18.000Z"))
    )
  })

  it("preserves a nonstandard timestamp for fallback display", () => {
    expect(formatLocalDateTime("beamtime cycle 4")).toBe("beamtime cycle 4")
    expect(timestampToLocalInput("beamtime cycle 4")).toBe("")
  })
})
