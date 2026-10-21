import { describe, expect, it } from "vitest"

import { resolveCollectionBrowse } from "./collection-browse"

import {
  accountPreferencesPatchSchema,
  accountPreferencesSchema,
  applyMergePatch,
} from "./preferences"

describe("account preferences", () => {
  it("applies an RFC 7396 merge patch", () => {
    expect(
      applyMergePatch(
        { theme: "dark", hub: { home_recent_scope: "mine", other: 1 } },
        { theme: null, hub: { home_recent_scope: "all" } }
      )
    ).toEqual({ hub: { home_recent_scope: "all", other: 1 } })
    expect(applyMergePatch({ hub: { a: 1 } }, { hub: null })).toEqual({})
    expect(applyMergePatch(undefined, { theme: "light" })).toEqual({
      theme: "light",
    })
  })

  it("ignores unknown keys and invalid values from newer clients", () => {
    expect(
      accountPreferencesSchema.parse({
        theme: "sepia",
        default_record_kind: "datasets",
        hub: {
          home_recent_scope: "mine",
          default_sort: {
            data: { sort: "name", direction: "asc" },
            projects: { sort: "activity", direction: "desc" },
            instruments: { sort: "invalid", direction: "desc" },
          },
          future: true,
        },
        other_client: {},
      })
    ).toEqual({
      default_record_kind: "datasets",
      hub: {
        home_recent_scope: "mine",
        default_sort: {
          data: { sort: "name", direction: "asc" },
          projects: { sort: "activity", direction: "desc" },
        },
      },
    })
  })

  it("keeps the include public data default only when it is a boolean", () => {
    expect(
      accountPreferencesSchema.parse({ hub: { include_public_data: true } })
    ).toEqual({ hub: { include_public_data: true } })
    expect(
      accountPreferencesSchema.parse({ hub: { include_public_data: "yes" } })
    ).toEqual({ hub: {} })
    expect(
      accountPreferencesPatchSchema.parse({
        hub: { include_public_data: false },
      })
    ).toEqual({ hub: { include_public_data: false } })
  })

  it("accepts only known, non-empty patches", () => {
    expect(accountPreferencesPatchSchema.safeParse({}).success).toBe(false)
    expect(
      accountPreferencesPatchSchema.safeParse({ unknown: 1 }).success
    ).toBe(false)
    expect(
      accountPreferencesPatchSchema.safeParse({ theme: "sepia" }).success
    ).toBe(false)
    expect(
      accountPreferencesPatchSchema.safeParse({
        hub: {
          home_recent_scope: null,
          default_sort: {
            data: { sort: "updated", direction: "desc" },
            projects: null,
          },
        },
        theme: null,
      }).success
    ).toBe(true)
  })
})

describe("default collection grouping", () => {
  const options = [
    { label: "Sample type", value: "sample_type" },
    { label: "Owner", value: "owner" },
  ] as const

  it("groups by the preferred field when the URL does not choose a view", () => {
    expect(resolveCollectionBrowse({}, options, "owner")).toMatchObject({
      field: "owner",
      view: "grouped",
    })
  })

  it("keeps an explicit flat list and an explicit field", () => {
    expect(
      resolveCollectionBrowse({ view: "list" }, options, "owner").view
    ).toBe("list")
    expect(
      resolveCollectionBrowse(
        { groupBy: "sample_type", view: "grouped" },
        options,
        "owner"
      ).field
    ).toBe("sample_type")
  })

  it("ignores a preferred field the collection does not offer", () => {
    expect(resolveCollectionBrowse({}, options, "instrument").view).toBe("list")
  })
})
