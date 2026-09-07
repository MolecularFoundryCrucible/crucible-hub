import { describe, expect, it } from "vitest"

import { HubApiClientError } from "@/data/crucible/result"

import {
  creationFailureMessage,
  isUncertainCreationError,
} from "./creation-error"

function apiError(kind: HubApiClientError["details"]["kind"]) {
  return new HubApiClientError({
    correlationId: "test-correlation",
    kind,
    message: "Safe API message.",
    retryable: false,
  })
}

describe("creation failure handling", () => {
  it.each(["cancelled", "timeout", "unexpected", "upstream"] as const)(
    "treats %s outcomes as uncertain",
    (kind) => {
      expect(isUncertainCreationError(apiError(kind))).toBe(true)
    }
  )

  it.each([
    "conflict",
    "forbidden",
    "not-found",
    "rate-limited",
    "unauthenticated",
    "validation",
  ] as const)("keeps %s rejections correctable", (kind) => {
    const error = apiError(kind)
    expect(isUncertainCreationError(error)).toBe(false)
    expect(creationFailureMessage("sample", error)).toContain(
      "Safe API message."
    )
  })

  it("directs uncertain creates to Data before resubmission", () => {
    expect(creationFailureMessage("dataset", apiError("timeout"))).toContain(
      "Check Data before submitting again."
    )
  })
})
