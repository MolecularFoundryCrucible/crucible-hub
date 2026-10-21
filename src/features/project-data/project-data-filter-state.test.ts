import { describe, expect, it } from "vitest"

import { resolveProjectDataFilters } from "./project-data-filter-state"

describe("project data filter state", () => {
  it("adds the member affiliation unless public data is included", () => {
    const access = { elevated: false, includePublicByDefault: false }
    const excluded = resolveProjectDataFilters(
      {},
      "datasets",
      undefined,
      access
    )
    const included = resolveProjectDataFilters(
      { publicData: "include" },
      "datasets",
      undefined,
      access
    )
    const elevated = resolveProjectDataFilters({}, "samples", undefined, {
      elevated: true,
      includePublicByDefault: false,
    })

    expect(excluded.valid && excluded.filters.affiliation).toBe("member")
    expect(included.valid && included.filters.affiliation).toBeUndefined()
    expect(included.valid && included.filters.publicData).toBe("include")
    expect(elevated.valid && elevated.filters.affiliation).toBeUndefined()
  })

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
    ).toMatchObject({
      filters: {
        createdFrom: "2026-01-01",
        createdTo: "2026-01-31",
        direction: "desc",
        instrumentMfid: "instrument-1",
        sort: "created",
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
