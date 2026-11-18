import { describe, expect, it } from "vitest"

import { instrumentDatasetScope } from "./instrument-dataset-scope"

const base = { elevated: false, includePublicByDefault: false }

describe("instrumentDatasetScope", () => {
  it.each(["viewer", "editor", "admin", "owner"])(
    "shows a %s every dataset on the instrument by default",
    (role) => {
      expect(instrumentDatasetScope({ ...base, role })).toEqual({
        affiliation: "member",
        includeInstrumentAccess: true,
        member: true,
      })
    }
  )

  it("ignores public data while showing all of a member's datasets", () => {
    expect(
      instrumentDatasetScope({ ...base, publicData: "include", role: "viewer" })
    ).toEqual({
      affiliation: "member",
      includeInstrumentAccess: true,
      member: true,
    })
  })

  it("leaves out instrument access for a member who asks for personal datasets", () => {
    expect(
      instrumentDatasetScope({ ...base, access: "personal", role: "admin" })
    ).toEqual({ affiliation: "member", member: true })
  })

  it("adds public data to a member's personal datasets on request", () => {
    expect(
      instrumentDatasetScope({
        ...base,
        access: "personal",
        publicData: "include",
        role: "admin",
      })
    ).toEqual({ affiliation: undefined, member: true })
  })

  it("keeps a non-member on their own access", () => {
    expect(instrumentDatasetScope({ ...base, role: null })).toEqual({
      affiliation: "member",
      member: false,
    })
    expect(
      instrumentDatasetScope({
        ...base,
        includePublicByDefault: true,
        role: undefined,
      })
    ).toEqual({ affiliation: undefined, member: false })
  })

  it("does not offer the choice in Administrator view", () => {
    expect(
      instrumentDatasetScope({ ...base, elevated: true, role: "owner" })
    ).toEqual({ affiliation: undefined, member: false })
  })
})
