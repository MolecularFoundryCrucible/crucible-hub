import { describe, expect, it } from "vitest"

import {
  dateRangeLabel,
  dateSliderStops,
  dayInTimeZone,
} from "./date-range-filter"

describe("date range filter", () => {
  it("finds the calendar day in the viewer's time zone, not UTC", () => {
    const evening = "2026-10-27T03:00:00Z"
    expect(dayInTimeZone(evening, "America/Los_Angeles")).toBe("2026-10-26")
    expect(dayInTimeZone(evening, "UTC")).toBe("2026-10-27")
  })

  it.each([
    ["2026-08-03", "2026-10-15", "day"],
    ["2025-01-15", "2026-06-30", "week"],
    ["2019-03-12", "2026-10-26", "month"],
    ["2001-05-01", "2026-10-26", "year"],
  ] as const)("steps %s to %s by %s", (earliest, latest, unit) => {
    expect(dateSliderStops(earliest, latest).unit).toBe(unit)
  })

  it("aligns stops to calendar periods covering the whole span", () => {
    const weeks = dateSliderStops("2025-01-15", "2026-06-30")
    expect(weeks.boundaries[0]).toBe("2025-01-13")
    expect(
      weeks.boundaries.every(
        (day) => new Date(`${day}T00:00:00Z`).getUTCDay() === 1
      )
    ).toBe(true)

    const months = dateSliderStops("2019-03-12", "2026-10-26")
    expect(months.boundaries[0]).toBe("2019-03-01")
    expect(months.boundaries.at(-1)).toBe("2026-11-01")
    expect(months.boundaries.every((day) => day.endsWith("-01"))).toBe(true)
  })

  it("keeps a single-day span movable", () => {
    expect(dateSliderStops("2026-08-01", "2026-08-01").boundaries).toEqual([
      "2026-08-01",
      "2026-08-02",
    ])
  })

  it("labels a range as one filter", () => {
    expect(
      dateRangeLabel("Created", { from: "2026-08-01", to: "2026-08-31" })
    ).toBe("Created: Aug 1, 2026 to Aug 31, 2026")
    expect(dateRangeLabel("Created", { from: "2026-08-01" })).toBe(
      "Created: since Aug 1, 2026"
    )
    expect(dateRangeLabel("Created", { to: "2026-08-31" })).toBe(
      "Created: until Aug 31, 2026"
    )
    expect(dateRangeLabel("Created", {})).toBeUndefined()
  })
})
