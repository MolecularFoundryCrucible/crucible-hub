import { describe, expect, it } from "vitest"

import { HubApiClientError, unwrapHubResult } from "./result"

describe("Hub API results", () => {
  it("returns successful data unchanged", () => {
    expect(unwrapHubResult({ status: "ok", data: { value: 4 } })).toEqual({
      value: 4,
    })
  })

  it("throws a browser-safe error with its correlation reference", () => {
    const error = {
      kind: "forbidden" as const,
      message: "You do not have permission to perform this action.",
      correlationId: "request-42",
      retryable: false,
    }

    expect(() => unwrapHubResult({ status: "error", error })).toThrow(
      HubApiClientError
    )

    try {
      unwrapHubResult({ status: "error", error })
    } catch (caught) {
      expect(caught).toMatchObject({
        details: error,
        message:
          "You do not have permission to perform this action. Reference: request-42",
      })
    }
  })
})
