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
      "normal",
      "datasets",
      "list",
      {
        direction: "desc",
        includeTotal: true,
        limit: 50,
        sort: "created",
      },
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
      "normal",
      "datasets",
      "list",
      {
        direction: "desc",
        includeTotal: true,
        instrumentMfid: "fixture-instrument-1",
        limit: 50,
        sort: "created",
      },
    ])
  })

  it("normalizes project scope in sample and dataset keys", () => {
    expect(
      samplesQueryOptions(scope, {
        limit: 50,
        projectMfid: " fixture-project-1 ",
      }).queryKey[6]
    ).toEqual({
      direction: "desc",
      includeTotal: true,
      limit: 50,
      projectMfid: "fixture-project-1",
      projectScope: "all",
      sort: "created",
    })
    expect(
      datasetsQueryOptions(scope, {
        limit: 50,
        projectMfid: "fixture-project-1",
        projectScope: "shared",
      }).queryKey[6]
    ).toEqual({
      direction: "desc",
      includeTotal: true,
      limit: 50,
      projectMfid: "fixture-project-1",
      projectScope: "shared",
      sort: "created",
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
      }).queryKey[6]
    ).toEqual({
      createdFrom: "2026-08-27",
      createdTo: "2026-08-29",
      direction: "desc",
      includeTotal: true,
      limit: 50,
      sort: "created",
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
