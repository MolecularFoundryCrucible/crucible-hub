import { dehydrate, hydrate } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"

import { crucibleKeys, identityScope } from "./crucible/query-keys"
import { HubApiClientError } from "./crucible/result"
import {
  createQueryClient,
  queryRetryDelay,
  shouldRetryQuery,
} from "./query-client"

describe("Crucible Query client", () => {
  it("dehydrates the deletion request lists the server renders", () => {
    const scope = identityScope("staging", "user-a")
    const source = createQueryClient()
    source.setQueryData(crucibleKeys.deletionRequests(scope, {}), {
      pages: [],
      pageParams: [],
    })
    source.setQueryData(crucibleKeys.deletionAudit(scope, {}), {
      pages: [],
      pageParams: [],
    })

    expect(dehydrate(source).queries).toHaveLength(2)
  })

  it("dehydrates and hydrates only successful identity-scoped queries", async () => {
    const scope = identityScope("staging", "user-a")
    const elevatedScope = identityScope("staging", "user-a", "elevated")
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
    source.setQueryData(crucibleKeys.accountProfile(elevatedScope), {
      unique_id: "user-a",
      username: "elevated-ada",
    })
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
    expect(
      target.getQueryData(crucibleKeys.accountProfile(elevatedScope))
    ).toBeUndefined()
    expect(JSON.stringify(dehydrated)).not.toContain("upstream detail")
    expect(JSON.stringify(dehydrated)).not.toContain("private experiment")
  })

  it("dehydrates account preferences so the client renders with them", () => {
    const client = createQueryClient()
    const scope = identityScope("server-a", "account-a", "normal")
    client.setQueryData(crucibleKeys.accountPreferences(scope), {
      preferences: { hub: { home_recent_scope: "mine" } },
    })

    expect(
      dehydrate(client).queries.map((query) => query.queryKey)
    ).toContainEqual(crucibleKeys.accountPreferences(scope))
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

  it("does not retry terminal API errors", () => {
    const error = new HubApiClientError({
      correlationId: "correlation-id",
      kind: "not-found",
      message: "The resource was not found.",
      retryable: false,
    })

    expect(shouldRetryQuery(0, error)).toBe(false)
    expect(shouldRetryQuery(1, new Error("Network error"))).toBe(true)
    expect(shouldRetryQuery(2, new Error("Network error"))).toBe(false)
  })

  it("honors bounded API retry timing", () => {
    const error = new HubApiClientError({
      correlationId: "correlation-id",
      kind: "rate-limited",
      message: "Try again shortly.",
      retryAfterSeconds: 60,
      retryable: true,
    })

    expect(shouldRetryQuery(0, error)).toBe(false)
    expect(queryRetryDelay(0, error)).toBe(30_000)
    expect(queryRetryDelay(2, new Error("Network error"))).toBe(4_000)
  })
})
