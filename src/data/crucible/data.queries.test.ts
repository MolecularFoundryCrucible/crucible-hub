import { describe, expect, it } from "vitest"

import { datasetsQueryOptions, samplesQueryOptions } from "./data.queries"
import { identityScope } from "./query-keys"

describe("dataset query options", () => {
  const scope = identityScope("hosted", "account-a")

  it("rejects empty project or instrument MFIDs instead of issuing global queries", () => {
    expect(() =>
      samplesQueryOptions(scope, { limit: 50, projectMfid: " " })
    ).toThrow("The project MFID must not be empty.")
    expect(() =>
      datasetsQueryOptions(scope, { limit: 50, projectMfid: " " })
    ).toThrow("The project MFID must not be empty.")
    expect(() =>
      datasetsQueryOptions(scope, { instrumentMfid: " ", limit: 50 })
    ).toThrow("The instrument MFID must contain 1 to 255 characters.")
    expect(() =>
      datasetsQueryOptions(scope, {
        instrumentMfid: "x".repeat(256),
        limit: 50,
      })
    ).toThrow("The instrument MFID must contain 1 to 255 characters.")
  })
})
