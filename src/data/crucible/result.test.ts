import { describe, expect, it } from "vitest"

import { HubApiClientError, hubConflictFields, unwrapHubResult } from "./result"

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

describe("hub conflict fields", () => {
  const conflict = (conflictFields?: ("email" | "username")[]) =>
    new HubApiClientError({
      correlationId: "request",
      kind: "conflict",
      message: "Conflict",
      retryable: false,
      ...(conflictFields ? { conflictFields } : {}),
    })

  it("uses reported fields and falls back for older responses", () => {
    expect(hubConflictFields(conflict(["email"]), ["username"])).toEqual([
      "email",
    ])
    expect(hubConflictFields(conflict(), ["username"])).toEqual(["username"])
    expect(hubConflictFields(new Error("other"), ["username"])).toEqual([])
  })
})
