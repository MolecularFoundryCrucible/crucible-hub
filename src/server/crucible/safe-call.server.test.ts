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

  it("surfaces a numeric Retry-After from a rate-limited response", async () => {
    const result = await safeCrucibleCall("retry-after", async () => {
      throw new CrucibleResponseError(
        new Response(null, {
          status: 429,
          headers: { "Retry-After": "5" },
        })
      )
    })

    expect(result).toMatchObject({
      status: "error",
      error: {
        kind: "rate-limited",
        retryable: true,
        retryAfterSeconds: 5,
      },
    })
  })

  it.each([
    ["an HTTP-date", "Fri, 09 Oct 2026 12:00:00 GMT"],
    ["a non-numeric value", "soon"],
    ["an empty value", ""],
  ])("ignores %s in Retry-After", async (_label, value) => {
    const result = await safeCrucibleCall("retry-after", async () => {
      throw new CrucibleResponseError(
        new Response(null, {
          status: 429,
          headers: { "Retry-After": value },
        })
      )
    })

    expect(result).toMatchObject({
      status: "error",
      error: { kind: "rate-limited" },
    })
    expect(result.status === "error" && result.error.retryAfterSeconds).toBe(
      undefined
    )
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

  it("reports which fields conflicted without exposing the API message", async () => {
    const body = {
      detail: {
        code: "already_in_use",
        fields: ["email", "unknown"],
        message: "Email is already in use",
      },
    }
    const result = await safeCrucibleCall("conflict", async () => {
      throw new CrucibleResponseError(new Response(null, { status: 409 }), body)
    })

    expect(result).toEqual({
      status: "error",
      error: {
        kind: "conflict",
        message: "The request conflicts with the current Crucible state.",
        correlationId: "conflict",
        retryable: false,
        conflictFields: ["email"],
      },
    })
  })

  it("ignores conflict bodies without the structured code", async () => {
    const result = await safeCrucibleCall("plain-conflict", async () => {
      throw new CrucibleResponseError(new Response(null, { status: 409 }), {
        detail: "Username already taken",
      })
    })

    expect(result.status === "error" && result.error.conflictFields).toBe(
      undefined
    )
  })

  it("forwards only recognized conflict codes", async () => {
    const storage = await safeCrucibleCall("storage", async () => {
      throw new CrucibleResponseError(new Response(null, { status: 409 }), {
        detail: {
          code: "storage_location_invalid",
          reason: "outside dataset",
          message: "File storage location is not valid: outside dataset",
        },
      })
    })
    const other = await safeCrucibleCall("other", async () => {
      throw new CrucibleResponseError(new Response(null, { status: 409 }), {
        detail: { code: "something_else" },
      })
    })

    expect(storage.status === "error" && storage.error.conflictCode).toBe(
      "storage_location_invalid"
    )
    expect(other.status === "error" && other.error).not.toHaveProperty(
      "conflictCode"
    )
  })

  it("asks for a fresh sign-in on a step-up challenge", async () => {
    const result = await safeCrucibleCall("step-up", async () => {
      throw new CrucibleResponseError(
        new Response(null, {
          headers: {
            "WWW-Authenticate":
              'Bearer error="insufficient_user_authentication", max_age="600"',
          },
          status: 401,
        })
      )
    })

    expect(result).toMatchObject({
      status: "error",
      error: {
        kind: "reauthentication-required",
        message: "Sign in again to continue.",
        retryable: false,
      },
    })
  })
})
