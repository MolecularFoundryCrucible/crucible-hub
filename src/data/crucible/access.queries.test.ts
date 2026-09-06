import { describe, expect, it } from "vitest"

import { identityScope } from "./query-keys"
import { resourceAccessQueryOptions } from "./access.queries"

describe("resource access query options", () => {
  it("uses resource access keys scoped by server and account identity", () => {
    const first = resourceAccessQueryOptions(
      identityScope("fixture:populated", "account-1"),
      "resource-1"
    )
    const second = resourceAccessQueryOptions(
      identityScope("fixture:populated", "account-2"),
      "resource-1"
    )

    expect(first.queryKey).toEqual([
      "crucible",
      "fixture:populated",
      "account-1",
      "resources",
      "access",
      "resource-1",
    ])
    expect(first.queryKey).not.toEqual(second.queryKey)
  })
})
