import { describe, expect, it, vi } from "vitest"

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

  it("says a route this API version lacks is not available, without an error log", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {})
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => {})
    const missing = (status: number) =>
      safeCrucibleCall("missing", async () => {
        throw new CrucibleResponseError(new Response(null, { status }), {
          detail: status === 404 ? "Not Found" : "Method Not Allowed",
        })
      })

    for (const status of [404, 405]) {
      expect(await missing(status)).toMatchObject({
        status: "error",
        error: {
          kind: "unavailable",
          message: "This isn't available on this Crucible server yet.",
          retryable: false,
        },
      })
    }
    expect(errors).not.toHaveBeenCalled()
    expect(warnings).toHaveBeenCalledTimes(2)
    errors.mockRestore()
    warnings.mockRestore()
  })

  it("keeps a missing record as not found", async () => {
    const result = await safeCrucibleCall("record", async () => {
      throw new CrucibleResponseError(new Response(null, { status: 404 }), {
        detail: "User not found",
      })
    })

    expect(result).toMatchObject({ error: { kind: "not-found" } })
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

  it.each([
    [429, "too_many_links"],
    [403, "hub_session_required"],
  ])("forwards the code of a %i refusal", async (status, code) => {
    const result = await safeCrucibleCall("refused", async () => {
      throw new CrucibleResponseError(new Response(null, { status }), {
        detail: { code },
      })
    })
    expect(result.status === "error" && result.error.conflictCode).toBe(code)
  })

  it.each([
    [404, "no_password"],
    [501, "feature_disabled"],
    [403, "browser_sign_in_required"],
    [409, "username_required"],
  ])("forwards the password code of a %i answer", async (status, code) => {
    const result = await safeCrucibleCall("password", async () => {
      throw new CrucibleResponseError(new Response(null, { status }), {
        detail: { code, feature: "passwords" },
      })
    })
    expect(result.status === "error" && result.error.conflictCode).toBe(code)
  })

  it("names the password field the API refused", async () => {
    const result = await safeCrucibleCall("password", async () => {
      throw new CrucibleResponseError(new Response(null, { status: 422 }), {
        detail: [
          {
            ctx: { reason: "common" },
            loc: ["body", "new_password"],
            msg: "From the API",
            type: "password_rejected",
          },
          {
            loc: ["body", "current_password"],
            msg: "From the API",
            type: "current_password_invalid",
          },
          {
            ctx: { reason: "unheard_of" },
            loc: ["body", "new_password"],
            type: "password_rejected",
          },
        ],
      })
    })
    expect(result.status === "error" && result.error.fieldErrors).toEqual({
      current_password: ["That isn't your current password."],
      new_password: [
        "This password is commonly used, so it is easy to guess. Choose another one.",
      ],
    })
    expect(JSON.stringify(result)).not.toContain("From the API")
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

describe("value issues from the API", () => {
  it("names the field with an unsupported character or invalid number", async () => {
    const result = await safeCrucibleCall("correlation-1", () => {
      throw new CrucibleResponseError(new Response(null, { status: 422 }), {
        detail: [
          {
            loc: ["body", "scientific_metadata", "note"],
            msg: "NUL is not allowed",
            type: "unsupported_character",
          },
        ],
      })
    })
    expect(result).toMatchObject({
      error: {
        fieldErrors: {
          "scientific_metadata.note": [
            "A value contains a character Crucible cannot store.",
          ],
        },
        kind: "validation",
        message:
          "A value contains a character Crucible cannot store. (scientific_metadata.note)",
      },
      status: "error",
    })
  })
})
