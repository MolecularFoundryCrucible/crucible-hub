import { describe, expect, it } from "vitest"

import {
  dateRangeLabel,
  dateSliderScale,
  dayInTimeZone,
} from "./date-range-filter"

describe("date range filter", () => {
  it("finds the calendar day in the viewer's time zone, not UTC", () => {
    const evening = "2026-10-27T03:00:00Z"
    expect(dayInTimeZone(evening, "America/Los_Angeles")).toBe("2026-10-26")
    expect(dayInTimeZone(evening, "UTC")).toBe("2026-10-27")
  })

  it.each([
    ["2026-08-01", "2026-09-30", 1],
    ["2025-01-01", "2026-06-30", 7],
    ["2019-03-01", "2026-10-26", 30],
  ])("steps a span from %s to %s by %i days", (earliest, latest, step) => {
    const scale = dateSliderScale(earliest, latest)
    expect(scale.step).toBe(step)
    expect((scale.max - scale.min) % step).toBe(0)
    expect(scale.max).toBeGreaterThanOrEqual(
      Date.parse(`${latest}T00:00:00Z`) / 86_400_000
    )
  })

  it("keeps a single-day span movable", () => {
    const scale = dateSliderScale("2026-08-01", "2026-08-01")
    expect(scale.max).toBeGreaterThan(scale.min)
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
