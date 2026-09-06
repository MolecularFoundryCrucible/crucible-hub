import { describe, expect, it } from "vitest"

import { resolveProjectDataFilters } from "./project-data-filter-state"

describe("project data filter state", () => {
  it("normalizes valid collection and dataset instrument filters", () => {
    expect(
      resolveProjectDataFilters(
        {
          createdFrom: "2026-01-01",
          createdTo: "2026-01-31",
          instrumentMfid: "instrument-1",
          visibility: "all",
        },
        "datasets"
      )
    ).toEqual({
      filters: {
        createdFrom: "2026-01-01",
        createdTo: "2026-01-31",
        instrumentMfid: "instrument-1",
      },
      valid: true,
    })
  })

  it.each([
    [{ visibility: "secret" }, "samples"],
    [{ createdFrom: "2026-02-30" }, "samples"],
    [{ createdFrom: "2026-03-02", createdTo: "2026-03-01" }, "samples"],
    [{ instrumentMfid: "instrument-1" }, "samples"],
    [{ instrumentMfid: "" }, "datasets"],
    [{ instrumentMfid: "x".repeat(256) }, "datasets"],
  ] as const)("rejects invalid or hidden filters", (search, kind) => {
    expect(resolveProjectDataFilters(search, kind).valid).toBe(false)
  })
})
