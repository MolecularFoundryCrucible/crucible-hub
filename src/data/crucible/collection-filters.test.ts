import { describe, expect, it } from "vitest"

import {
  collectionFiltersSchema,
  normalizeCollectionFilters,
} from "./collection-filters"

describe("collection filters", () => {
  it("normalizes the all visibility and absent fields to omission", () => {
    expect(normalizeCollectionFilters()).toEqual({})
    expect(normalizeCollectionFilters({ visibility: "all" })).toEqual({})
    expect(
      normalizeCollectionFilters({
        createdFrom: "2024-02-29",
        createdTo: "2024-03-01",
        visibility: "public",
      })
    ).toEqual({
      createdFrom: "2024-02-29",
      createdTo: "2024-03-01",
      visibility: "public",
    })
  })

  it.each([
    { createdFrom: "2023-02-29" },
    { createdFrom: "2026-13-01" },
    { createdFrom: "2026-04-31" },
    { createdFrom: "2026-1-01" },
    { createdFrom: "0000-01-01" },
    { createdFrom: "2026-09-02", createdTo: "2026-09-01" },
  ])("rejects invalid date filters %#", (filters) => {
    expect(collectionFiltersSchema.safeParse(filters).success).toBe(false)
  })
})
