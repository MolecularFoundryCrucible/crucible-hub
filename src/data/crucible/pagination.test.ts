import { describe, expect, it } from "vitest"

import { identityScopedPreviousData, sameKindPreviousData } from "./pagination"
import { identityScope } from "./query-keys"

describe("identityScopedPreviousData", () => {
  const scope = identityScope("hosted", "account-a")

  it("retains a previous page only for the same account, server and privilege mode", () => {
    const page = { items: ["private-project"] }

    expect(
      identityScopedPreviousData(scope, page, {
        queryKey: [...scope, "projects", "list", { offset: 0 }],
      })
    ).toBe(page)
    expect(
      identityScopedPreviousData(scope, page, {
        queryKey: ["crucible", "hosted", "account-b", "normal", "projects"],
      })
    ).toBeUndefined()
    expect(
      identityScopedPreviousData(scope, page, {
        queryKey: [
          "crucible",
          "other-server",
          "account-a",
          "normal",
          "projects",
        ],
      })
    ).toBeUndefined()
    expect(
      identityScopedPreviousData(scope, page, {
        queryKey: ["crucible", "hosted", "account-a", "elevated", "projects"],
      })
    ).toBeUndefined()
  })
})

describe("sameKindPreviousData", () => {
  const scope = identityScope("hosted", "account-a")
  const page = { items: ["group-a"] }
  const key = (params: Record<string, unknown>) => ({
    queryKey: [...scope, "facets", params],
  })

  it("keeps results when only other parameters change", () => {
    expect(
      sameKindPreviousData(
        scope,
        { field: "measurement" },
        page,
        key({ field: "measurement", sort: "count" })
      )
    ).toBe(page)
  })

  it("drops results of another kind or another account", () => {
    expect(
      sameKindPreviousData(
        scope,
        { field: "measurement" },
        page,
        key({ field: "instrument" })
      )
    ).toBeUndefined()
    expect(
      sameKindPreviousData(
        scope,
        { mode: undefined },
        page,
        key({ mode: "metadata" })
      )
    ).toBeUndefined()
    expect(
      sameKindPreviousData(scope, { field: "measurement" }, page, {
        queryKey: [
          ...identityScope("hosted", "account-b"),
          "facets",
          { field: "measurement" },
        ],
      })
    ).toBeUndefined()
  })
})
