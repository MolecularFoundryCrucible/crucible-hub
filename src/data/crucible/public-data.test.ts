import { describe, expect, it } from "vitest"

import {
  effectivePublicData,
  publicDataFilterState,
  publicDataSearchValue,
  resolveCollectionAffiliation,
} from "./public-data"

describe("resolveCollectionAffiliation", () => {
  it("lets ownership win over the public data filter", () => {
    expect(
      resolveCollectionAffiliation({
        elevated: false,
        includePublicByDefault: true,
        ownership: "owner",
        publicData: "include",
      })
    ).toBe("owner")
  })

  it("never narrows in administrator view", () => {
    for (const publicData of ["include", "exclude", undefined] as const) {
      expect(
        resolveCollectionAffiliation({
          elevated: true,
          includePublicByDefault: false,
          publicData,
        })
      ).toBeUndefined()
    }
  })

  it("excludes public data by default", () => {
    expect(
      resolveCollectionAffiliation({
        elevated: false,
        includePublicByDefault: false,
      })
    ).toBe("member")
  })

  it("follows an explicit choice over the saved default", () => {
    expect(
      resolveCollectionAffiliation({
        elevated: false,
        includePublicByDefault: false,
        publicData: "include",
      })
    ).toBeUndefined()
    expect(
      resolveCollectionAffiliation({
        elevated: false,
        includePublicByDefault: true,
        publicData: "exclude",
      })
    ).toBe("member")
  })

  it("follows the saved default when no choice is made", () => {
    expect(
      resolveCollectionAffiliation({
        elevated: false,
        includePublicByDefault: true,
      })
    ).toBeUndefined()
  })
})

describe("public data search values", () => {
  it("resolves the effective choice", () => {
    expect(effectivePublicData(undefined, false)).toBe(false)
    expect(effectivePublicData(undefined, true)).toBe(true)
    expect(effectivePublicData("include", false)).toBe(true)
    expect(effectivePublicData("exclude", true)).toBe(false)
  })

  it("writes a URL value only when it differs from the default", () => {
    expect(publicDataSearchValue(true, true)).toBeUndefined()
    expect(publicDataSearchValue(false, false)).toBeUndefined()
    expect(publicDataSearchValue(false, true)).toBe("exclude")
    expect(publicDataSearchValue(true, false)).toBe("include")
  })
})

describe("publicDataFilterState", () => {
  it("shows the Public pill whenever public data is included", () => {
    expect(
      publicDataFilterState({
        elevated: false,
        includePublicByDefault: true,
      })
    ).toEqual({ available: true, enabled: true, included: true })
    expect(
      publicDataFilterState({
        elevated: false,
        includePublicByDefault: false,
        publicData: "include",
      }).included
    ).toBe(true)
  })

  it("disables the filter while an ownership filter is active", () => {
    expect(
      publicDataFilterState({
        elevated: false,
        includePublicByDefault: true,
        ownership: "owner",
      })
    ).toEqual({ available: true, enabled: false, included: false })
  })

  it("hides the filter in administrator view", () => {
    expect(
      publicDataFilterState({
        elevated: true,
        includePublicByDefault: false,
      })
    ).toEqual({ available: false, enabled: false, included: false })
  })
})
