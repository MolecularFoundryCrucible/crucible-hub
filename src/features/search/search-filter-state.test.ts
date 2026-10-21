import { describe, expect, it } from "vitest"

import {
  searchAffiliation,
  searchFilterAvailability,
  searchKindsForFilters,
} from "./search-filter-state"

const member = { elevated: false, includePublicByDefault: false }

describe("searchFilterAvailability", () => {
  it("offers only the filters the selected tab can use", () => {
    expect(searchFilterAvailability("all")).toEqual({
      ownership: true,
      project: true,
      publicData: true,
    })
    expect(searchFilterAvailability("person")).toEqual({
      ownership: false,
      project: false,
      publicData: false,
    })
    expect(searchFilterAvailability("project")).toEqual({
      ownership: true,
      project: false,
      publicData: false,
    })
    expect(searchFilterAvailability("metadata")).toEqual({
      ownership: true,
      project: false,
      publicData: true,
    })
  })
})

describe("searchAffiliation", () => {
  it("narrows to the caller's grants unless public data is included", () => {
    expect(searchAffiliation("all", {}, member)).toBe("member")
    expect(searchAffiliation("all", { publicData: "include" }, member)).toBe(
      undefined
    )
  })

  it("prefers ownership and ignores filters the tab cannot use", () => {
    expect(
      searchAffiliation("instrument", { affiliation: "owner" }, member)
    ).toBe("owner")
    expect(searchAffiliation("person", { affiliation: "owner" }, member)).toBe(
      undefined
    )
  })
})

describe("searchKindsForFilters", () => {
  const kinds = [
    "person",
    "project",
    "instrument",
    "sample",
    "dataset",
  ] as const

  it("drops people from All when only owned resources are shown", () => {
    expect(
      searchKindsForFilters("all", kinds, { affiliation: "owner" })
    ).toEqual(["project", "instrument", "sample", "dataset"])
    expect(searchKindsForFilters("all", kinds, {})).toEqual(kinds)
  })
})
