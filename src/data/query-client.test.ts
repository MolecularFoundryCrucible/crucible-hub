import { dehydrate, hydrate } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"

import { crucibleKeys, identityScope } from "./crucible/query-keys"
import { createQueryClient } from "./query-client"

describe("Crucible Query client", () => {
  it("dehydrates and hydrates only successful identity-scoped queries", async () => {
    const scope = identityScope("staging", "user-a")
    const source = createQueryClient()
    source.setQueryData(crucibleKeys.accountProfile(scope), {
      unique_id: "user-a",
      username: "ada",
    })
    source.setQueryData(crucibleKeys.person(scope, "person-a"), {
      unique_id: "person-a",
      first_name: "Ada",
      last_name: "Lovelace",
      username: "ada",
    })
    source.setQueryData(["unscoped", "diagnostic"], "not browser state")
    source.setQueryData(
      crucibleKeys.search(scope, { query: "private experiment" }),
      { groups: [], query: "private experiment" }
    )
    await source
      .fetchQuery({
        queryKey: [...scope, "unknown", "failure"],
        queryFn: () => Promise.reject(new Error("upstream detail")),
        retry: false,
      })
      .catch(() => undefined)

    const dehydrated = dehydrate(source)
    const target = createQueryClient()
    hydrate(target, dehydrated)

    expect(dehydrated.queries).toHaveLength(2)
    expect(target.getQueryData(crucibleKeys.accountProfile(scope))).toEqual({
      unique_id: "user-a",
      username: "ada",
    })
    expect(target.getQueryData(crucibleKeys.person(scope, "person-a"))).toEqual(
      {
        unique_id: "person-a",
        first_name: "Ada",
        last_name: "Lovelace",
        username: "ada",
      }
    )
    expect(target.getQueryData(["unscoped", "diagnostic"])).toBeUndefined()
    expect(JSON.stringify(dehydrated)).not.toContain("upstream detail")
    expect(JSON.stringify(dehydrated)).not.toContain("private experiment")
  })

  it("keeps collection rows from overwriting authoritative detail", () => {
    const scope = identityScope("staging", "user-a")
    const client = createQueryClient()
    const collectionKey = crucibleKeys.datasets(scope, {
      cursor: null,
      limit: 50,
    })
    const detailKey = crucibleKeys.resource(
      scope,
      "dataset-mfid",
      "overview-with-metadata-links-owner"
    )
    client.setQueryData(detailKey, {
      unique_id: "dataset-mfid",
      name: "Authoritative detail",
      scientific_metadata: { edge: "Fe K" },
    })
    client.setQueryData(collectionKey, {
      items: [{ unique_id: "dataset-mfid", dataset_name: "List row" }],
    })
    client.setQueryData(collectionKey, {
      items: [{ unique_id: "dataset-mfid", dataset_name: "Updated list row" }],
    })

    expect(client.getQueryData(detailKey)).toEqual({
      unique_id: "dataset-mfid",
      name: "Authoritative detail",
      scientific_metadata: { edge: "Fe K" },
    })
  })
})
