import { describe, expect, it } from "vitest"

import { authEventsInfiniteQueryOptions } from "./crucible/auth-events.queries"
import { identityScope } from "./crucible/query-keys"
import { createQueryClient } from "./query-client"

describe("query retry defaults", () => {
  it("leaves the app retry rule in place for a live server", () => {
    const client = createQueryClient()
    const options = client.defaultQueryOptions(
      authEventsInfiniteQueryOptions(
        identityScope("server-1", "person-1"),
        undefined
      ) as never
    )
    expect(options.retry).toBe(client.getDefaultOptions().queries?.retry)
  })
})
