import { describe, expect, it } from "vitest"

import { crucibleKeys, identityScope } from "./query-keys"

describe("Crucible query keys", () => {
  it("scopes data by server and stable account identity", () => {
    const first = identityScope("staging", "user-a")
    const second = identityScope("staging", "user-b")

    expect(crucibleKeys.accountProfile(first)).not.toEqual(
      crucibleKeys.accountProfile(second)
    )
  })

  it("normalizes filter property order", () => {
    const scope = identityScope("staging", "user-a")

    expect(
      crucibleKeys.samples(scope, { visibility: "all", limit: 100 })
    ).toEqual(crucibleKeys.samples(scope, { limit: 100, visibility: "all" }))
  })

  it("keeps collection and detail representations distinct", () => {
    const scope = identityScope("staging", "user-a")

    expect(crucibleKeys.projects(scope, {})).not.toEqual(
      crucibleKeys.project(scope, "project-mfid")
    )
  })

  it("scopes public person detail by server and account", () => {
    const first = identityScope("staging", "user-a")
    const second = identityScope("staging", "user-b")

    expect(crucibleKeys.person(first, "person-a")).not.toEqual(
      crucibleKeys.person(second, "person-a")
    )
  })

  it("scopes the transitional workspace representation by identity", () => {
    const first = identityScope("staging", "user-a")
    const second = identityScope("staging", "user-b")

    expect(crucibleKeys.workspace(first)).not.toEqual(
      crucibleKeys.workspace(second)
    )
  })

  it("keeps sample and dataset cursor chains independent", () => {
    const scope = identityScope("staging", "user-a")

    expect(crucibleKeys.samples(scope, { cursor: "sample-next" })).not.toEqual(
      crucibleKeys.datasets(scope, { cursor: "dataset-next" })
    )
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

  it("keeps resource detail shapes and dataset files distinct", () => {
    const scope = identityScope("staging", "user-a")

    expect(
      crucibleKeys.resource(scope, "resource-mfid", "overview")
    ).not.toEqual(crucibleKeys.resource(scope, "resource-mfid", "metadata"))
    expect(
      crucibleKeys.resource(scope, "dataset-mfid", "overview")
    ).not.toEqual(crucibleKeys.datasetFiles(scope, "dataset-mfid"))
    expect(
      crucibleKeys.resource(scope, "dataset-mfid", "overview")
    ).not.toEqual(crucibleKeys.resourceAccess(scope, "dataset-mfid"))
  })

  it("keeps instrument pages distinct from other collections", () => {
    const scope = identityScope("staging", "user-a")

    expect(
      crucibleKeys.instruments(scope, { limit: 20, offset: 0 })
    ).not.toEqual(crucibleKeys.projects(scope, { limit: 20, offset: 0 }))
    expect(
      crucibleKeys.instruments(scope, { limit: 20, offset: 0 })
    ).not.toEqual(crucibleKeys.instruments(scope, { limit: 20, offset: 20 }))
  })

  it("normalizes global search filters within the identity scope", () => {
    const scope = identityScope("staging", "user-a")

    expect(
      crucibleKeys.search(scope, {
        query: "catalyst",
        kinds: ["dataset", "sample"],
      })
    ).toEqual(
      crucibleKeys.search(scope, {
        kinds: ["dataset", "sample"],
        query: "catalyst",
      })
    )
    expect(crucibleKeys.search(scope, { query: "catalyst" })).not.toEqual(
      crucibleKeys.search(scope, { query: "operando" })
    )
  })
})
