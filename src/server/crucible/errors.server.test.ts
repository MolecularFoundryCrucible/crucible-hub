import { describe, expect, it } from "vitest"

import { toHubApiError } from "./errors.server"

describe("safe API errors", () => {
  it("maps known statuses without reflecting an upstream body", () => {
    expect(toHubApiError({ status: 403, correlationId: "request-1" })).toEqual({
      kind: "forbidden",
      message: "You do not have permission to perform this action.",
      correlationId: "request-1",
      retryable: false,
    })
  })

  it("marks timeouts as retryable", () => {
    expect(
      toHubApiError({ timedOut: true, correlationId: "request-2" })
    ).toMatchObject({ kind: "timeout", retryable: true })
  })
})
