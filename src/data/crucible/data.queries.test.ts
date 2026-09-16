import { describe, expect, it } from "vitest"

import { datasetsQueryOptions, samplesQueryOptions } from "./data.queries"
import { identityScope } from "./query-keys"

describe("dataset query options", () => {
  const scope = identityScope("hosted", "account-a")

  it("separates global and instrument-scoped dataset keys", () => {
    expect(datasetsQueryOptions(scope, { limit: 50 }).queryKey).toEqual([
      "crucible",
      "hosted",
      "account-a",
      "datasets",
      "list",
      { limit: 50 },
    ])
    expect(
      datasetsQueryOptions(scope, {
        limit: 50,
        instrumentMfid: " fixture-instrument-1 ",
      }).queryKey
    ).toEqual([
      "crucible",
      "hosted",
      "account-a",
      "datasets",
      "list",
      { instrumentMfid: "fixture-instrument-1", limit: 50 },
    ])
  })

  it("normalizes project scope in sample and dataset keys", () => {
    expect(
      samplesQueryOptions(scope, {
        limit: 50,
        projectMfid: " fixture-project-1 ",
      }).queryKey[5]
    ).toEqual({
      limit: 50,
      projectMfid: "fixture-project-1",
      projectScope: "all",
    })
    expect(
      datasetsQueryOptions(scope, {
        limit: 50,
        projectMfid: "fixture-project-1",
        projectScope: "shared",
      }).queryKey[5]
    ).toEqual({
      limit: 50,
      projectMfid: "fixture-project-1",
      projectScope: "shared",
    })
  })

  it("rejects empty project MFIDs instead of issuing global queries", () => {
    expect(() =>
      samplesQueryOptions(scope, { limit: 50, projectMfid: " " })
    ).toThrow("The project MFID must not be empty.")
    expect(() =>
      datasetsQueryOptions(scope, { limit: 50, projectMfid: " " })
    ).toThrow("The project MFID must not be empty.")
  })

  it("normalizes collection filters identically in sample and dataset keys", () => {
    expect(
      samplesQueryOptions(scope, { limit: 50, visibility: "all" }).queryKey
    ).toEqual(samplesQueryOptions(scope, { limit: 50 }).queryKey)
    expect(
      datasetsQueryOptions(scope, {
        createdFrom: "2026-08-27",
        createdTo: "2026-08-29",
        limit: 50,
        visibility: "private",
      }).queryKey[5]
    ).toEqual({
      createdFrom: "2026-08-27",
      createdTo: "2026-08-29",
      limit: 50,
      visibility: "private",
    })
  })

  it("rejects empty or oversized instrument MFIDs instead of issuing global queries", () => {
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
