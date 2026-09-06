import { describe, expect, it } from "vitest"

import { CrucibleResponseError } from "./request-error.server"
import { safeCrucibleCall } from "./safe-call.server"

describe("safe Crucible calls", () => {
  it("returns successful data", async () => {
    await expect(
      safeCrucibleCall("request-1", async () => ({ value: 4 }))
    ).resolves.toEqual({ status: "ok", data: { value: 4 } })
  })

  it("maps an upstream status without exposing its error", async () => {
    const result = await safeCrucibleCall("request-2", async () => {
      throw new CrucibleResponseError(403)
    })

    expect(result).toEqual({
      status: "error",
      error: {
        kind: "forbidden",
        message: "You do not have permission to perform this action.",
        correlationId: "request-2",
        retryable: false,
      },
    })
  })

  it.each([
    ["AbortError", "cancelled", false],
    ["TimeoutError", "timeout", true],
  ] as const)("maps %s failures", async (name, kind, retryable) => {
    const result = await safeCrucibleCall("request-3", async () => {
      throw new DOMException("private detail", name)
    })

    expect(result).toMatchObject({
      status: "error",
      error: {
        kind,
        correlationId: "request-3",
        retryable,
      },
    })
  })

  it("does not expose unexpected server failure details", async () => {
    const result = await safeCrucibleCall("request-4", async () => {
      throw new Error("credentialed upstream URL and private response body")
    })

    expect(result).toEqual({
      status: "error",
      error: {
        kind: "unexpected",
        message: "An unexpected error occurred.",
        correlationId: "request-4",
        retryable: true,
      },
    })
    expect(JSON.stringify(result)).not.toContain("private response body")
  })
})
