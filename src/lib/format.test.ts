import { describe, expect, it } from "vitest"

import {
  formatDateInZone,
  formatRecentActivity,
  formatZonedDateTimeInZone,
  formatLocalDateTime,
  formatUtcDateTime,
  isValidLocalDateTime,
  localDateTimeToUtc,
  parseTimestamp,
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

  it("formats the stored instant with local date and 24-hour time", () => {
    expect(formatLocalDateTime("2026-09-05T19:42:18.000Z")).toBe(
      new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        hour: "2-digit",
        hourCycle: "h23",
        minute: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date("2026-09-05T19:42:18.000Z"))
    )
  })

  it("reads API microseconds, offsets, and offset-free values as instants", () => {
    const instant = Date.parse("2026-10-19T07:00:00.000Z")
    expect(parseTimestamp("2026-10-19T07:00:00.000000Z")?.getTime()).toBe(
      instant
    )
    expect(parseTimestamp("2026-10-19T07:00:00+00:00")?.getTime()).toBe(instant)
    expect(parseTimestamp("2026-10-19T00:00:00-07:00")?.getTime()).toBe(instant)
    expect(parseTimestamp("2026-10-19T07:00:00")?.getTime()).toBe(instant)
    expect(parseTimestamp("2026-10-19")).toBeNull()
  })

  it("labels the UTC fallback so it is not mistaken for local time", () => {
    expect(formatUtcDateTime("2026-10-19T07:00:00Z")).toBe(
      "Oct 19, 2026, 07:00 UTC"
    )
  })

  it("preserves a nonstandard timestamp for fallback display", () => {
    expect(formatLocalDateTime("beamtime cycle 4")).toBe("beamtime cycle 4")
    expect(timestampToLocalInput("beamtime cycle 4")).toBe("")
  })
})

describe("recent activity", () => {
  const now = new Date(2026, 9, 14, 15, 30)

  it("uses coarse, hour-safe wording", () => {
    expect(
      formatRecentActivity(new Date(2026, 9, 14, 15, 0).toISOString(), now)
    ).toBe("Last hour")
    expect(
      formatRecentActivity(new Date(2026, 9, 14, 8, 0).toISOString(), now)
    ).toBe("Today")
    expect(
      formatRecentActivity(new Date(2026, 9, 13, 23, 0).toISOString(), now)
    ).toBe("Yesterday")
    expect(
      formatRecentActivity(new Date(2026, 9, 10, 12, 0).toISOString(), now)
    ).toBe("4 days ago")
    expect(
      formatRecentActivity(new Date(2026, 8, 1, 12, 0).toISOString(), now)
    ).toBe("Sep 1, 2026")
    expect(formatRecentActivity(null, now)).toBeNull()
  })
})

describe("time zone aware formatting", () => {
  it("formats absolute times in the given zone, independent of the runtime", () => {
    expect(
      formatDateInZone("2026-08-30T17:31:00Z", "America/Los_Angeles")
    ).toBe("Aug 30, 2026, 10:31")
    expect(formatDateInZone("2026-08-30T17:31:00Z", "Europe/Zurich")).toBe(
      "Aug 30, 2026, 19:31"
    )
    expect(
      formatZonedDateTimeInZone("2026-08-30T17:31:00Z", "America/Los_Angeles")
    ).toBe("Aug 30, 2026, 10:31 PDT")
  })

  it("counts recent activity days in the given zone", () => {
    const now = new Date("2026-08-31T06:00:00Z")
    expect(
      formatRecentActivity("2026-08-31T01:00:00Z", now, "America/Los_Angeles")
    ).toBe("Today")
    expect(
      formatRecentActivity("2026-08-31T01:00:00Z", now, "Europe/Zurich")
    ).toBe("Today")
    expect(
      formatRecentActivity("2026-08-30T21:00:00Z", now, "Europe/Zurich")
    ).toBe("Yesterday")
  })
})
