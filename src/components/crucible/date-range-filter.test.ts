import { describe, expect, it } from "vitest"

import {
  activeDatePreset,
  datePresetStart,
  dateRangeLabel,
  todayInTimeZone,
} from "./date-range-filter"

describe("date range filter", () => {
  it("finds today in the viewer's time zone, not UTC", () => {
    const evening = new Date("2026-10-27T03:00:00Z")
    expect(todayInTimeZone("America/Los_Angeles", evening)).toBe("2026-10-26")
    expect(todayInTimeZone("UTC", evening)).toBe("2026-10-27")
  })

  it.each([
    ["7d", "2026-10-20"],
    ["30d", "2026-09-27"],
    ["12m", "2025-10-27"],
    ["year", "2026-01-01"],
  ])("starts the %s preset on %s", (id, start) => {
    expect(datePresetStart(id, "2026-10-26")).toBe(start)
  })

  it("recognizes the active preset only for an open-ended range", () => {
    expect(activeDatePreset({}, "2026-10-26")).toBe("any")
    expect(activeDatePreset({ from: "2026-09-27" }, "2026-10-26")).toBe("30d")
    expect(
      activeDatePreset({ from: "2026-09-27", to: "2026-10-26" }, "2026-10-26")
    ).toBeUndefined()
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
