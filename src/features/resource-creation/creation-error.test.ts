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
  it.each(["timeout", "upstream"] as const)(
    "treats %s outcomes as uncertain and directs them to Data before resubmission",
    (kind) => {
      expect(isUncertainCreationError(apiError(kind))).toBe(true)
      expect(creationFailureMessage("dataset", apiError(kind))).toContain(
        "Check Data before submitting again."
      )
    }
  )

  it.each(["forbidden", "validation"] as const)(
    "keeps %s rejections correctable",
    (kind) => {
      const error = apiError(kind)
      expect(isUncertainCreationError(error)).toBe(false)
      expect(creationFailureMessage("sample", error)).toContain(
        "Safe API message."
      )
    }
  )
})
