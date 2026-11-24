import { describe, expect, it } from "vitest"

import { crucibleKeys, identityScope, sameAccountKey } from "./query-keys"

describe("Crucible query keys", () => {
  it("scopes data by server and stable account identity", () => {
    const first = identityScope("staging", "user-a")
    const second = identityScope("staging", "user-b")
    const elevated = identityScope("staging", "user-a", "elevated")

    expect(crucibleKeys.accountProfile(first)).not.toEqual(
      crucibleKeys.accountProfile(second)
    )
    expect(crucibleKeys.accountProfile(first)).not.toEqual(
      crucibleKeys.accountProfile(elevated)
    )
  })

  it("normalizes filter property order", () => {
    const scope = identityScope("staging", "user-a")

    expect(
      crucibleKeys.samples(scope, { visibility: "all", limit: 100 })
    ).toEqual(crucibleKeys.samples(scope, { limit: 100, visibility: "all" }))
  })

  it("provides collection prefixes for narrow mutation invalidation", () => {
    const scope = identityScope("staging", "user-a")

    expect(crucibleKeys.samples(scope, { limit: 50 })).toEqual([
      ...crucibleKeys.sampleLists(scope),
      { limit: 50 },
    ])
    expect(crucibleKeys.datasets(scope, { limit: 50 })).toEqual([
      ...crucibleKeys.datasetLists(scope),
      { limit: 50 },
    ])
    expect(crucibleKeys.search(scope, { query: "catalyst" })).toEqual([
      ...crucibleKeys.searches(scope),
      { query: "catalyst" },
    ])
  })

  it("treats keys as the same account only when the server and account match", () => {
    const normal = crucibleKeys.recentResources(
      identityScope("staging", "user-a")
    )
    const elevated = crucibleKeys.recentResources(
      identityScope("staging", "user-a", "elevated")
    )
    const otherAccount = crucibleKeys.recentResources(
      identityScope("staging", "user-b", "elevated")
    )

    expect(sameAccountKey(normal, elevated)).toBe(true)
    expect(sameAccountKey(normal, otherAccount)).toBe(false)
  })
})
