import { describe, expect, it } from "vitest"

import {
  collectionScopedPreviousData,
  identityScopedPreviousData,
} from "./pagination"
import { identityScope } from "./query-keys"

describe("identityScopedPreviousData", () => {
  const scope = identityScope("hosted", "account-a")

  it("retains a previous page for the same identity", () => {
    const page = { items: ["project-a"] }

    expect(
      identityScopedPreviousData(scope, page, {
        queryKey: [...scope, "projects", "list", { offset: 0 }],
      })
    ).toBe(page)
  })

  it("does not retain data from another account or server", () => {
    const page = { items: ["private-project"] }

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
  })

  it("does not retain data from another privilege mode", () => {
    const page = { items: ["private-project"] }

    expect(
      identityScopedPreviousData(scope, page, {
        queryKey: ["crucible", "hosted", "account-a", "elevated", "projects"],
      })
    ).toBeUndefined()
  })
})

describe("collectionScopedPreviousData", () => {
  const scope = identityScope("hosted", "account-a")

  it("retains a previous page when optional filters are undefined and omitted from the normalized query key", () => {
    const page = { items: ["project-a"] }

    expect(
      collectionScopedPreviousData(
        scope,
        { affiliation: undefined, direction: undefined, sort: undefined },
        page,
        {
          queryKey: [...scope, "projects", "list", { limit: 50, offset: 0 }],
        }
      )
    ).toBe(page)
  })

  it("supports cursor-chain query keys and rejects mismatched filter contexts", () => {
    const page = { items: ["sample-a"] }

    expect(
      collectionScopedPreviousData(
        scope,
        { direction: "desc", sort: "created", visibility: undefined },
        page,
        {
          queryKey: [
            ...scope,
            "samples",
            "list",
            "cursor-chain",
            { direction: "desc", limit: 50, sort: "created" },
          ],
        }
      )
    ).toBe(page)

    expect(
      collectionScopedPreviousData(
        scope,
        { direction: "desc", sort: "created", visibility: "private" },
        page,
        {
          queryKey: [
            ...scope,
            "samples",
            "list",
            "cursor-chain",
            { direction: "desc", limit: 50, sort: "created" },
          ],
        }
      )
    ).toBeUndefined()
  })
})
