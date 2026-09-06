import { describe, expect, it } from "vitest"

import {
  datasetInstrumentScopedPreviousData,
  datasetsQueryOptions,
  samplesQueryOptions,
} from "./data.queries"
import { identityScope } from "./query-keys"

describe("dataset query options", () => {
  const scope = identityScope("hosted", "account-a")
  const page = { items: ["dataset"] }

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

  it("retains placeholders only for the same identity and instrument filter", () => {
    const scopedQueryKey = datasetsQueryOptions(scope, {
      limit: 50,
      instrumentMfid: "fixture-instrument-1",
    }).queryKey

    expect(
      datasetInstrumentScopedPreviousData(scope, "fixture-instrument-1", page, {
        queryKey: scopedQueryKey,
      })
    ).toBe(page)
    expect(
      datasetInstrumentScopedPreviousData(scope, "fixture-instrument-2", page, {
        queryKey: scopedQueryKey,
      })
    ).toBeUndefined()

    const filteredKey = datasetsQueryOptions(scope, {
      createdFrom: "2026-08-27",
      createdTo: "2026-08-29",
      instrumentMfid: "fixture-instrument-1",
      limit: 50,
      visibility: "public",
    }).queryKey
    expect(
      datasetInstrumentScopedPreviousData(
        scope,
        "fixture-instrument-1",
        page,
        { queryKey: filteredKey },
        undefined,
        undefined,
        {
          createdFrom: "2026-08-27",
          createdTo: "2026-08-29",
          visibility: "public",
        }
      )
    ).toBe(page)
    expect(
      datasetInstrumentScopedPreviousData(
        scope,
        "fixture-instrument-1",
        page,
        { queryKey: filteredKey },
        undefined,
        undefined,
        {
          createdFrom: "2026-08-27",
          createdTo: "2026-08-29",
          visibility: "private",
        }
      )
    ).toBeUndefined()
    expect(
      datasetInstrumentScopedPreviousData(
        scope,
        "fixture-instrument-1",
        page,
        { queryKey: filteredKey },
        undefined,
        undefined,
        {
          createdFrom: "2026-08-27",
          createdTo: "2026-08-30",
          visibility: "public",
        }
      )
    ).toBeUndefined()
    expect(
      datasetInstrumentScopedPreviousData(
        scope,
        "fixture-instrument-1",
        page,
        { queryKey: filteredKey },
        undefined,
        undefined,
        {
          createdFrom: "2026-08-28",
          createdTo: "2026-08-29",
          visibility: "public",
        }
      )
    ).toBeUndefined()
    expect(
      datasetInstrumentScopedPreviousData(scope, undefined, page, {
        queryKey: datasetsQueryOptions(scope, { limit: 50 }).queryKey,
      })
    ).toBe(page)
    expect(
      datasetInstrumentScopedPreviousData(scope, "fixture-instrument-1", page, {
        queryKey: datasetsQueryOptions(identityScope("hosted", "account-b"), {
          limit: 50,
          instrumentMfid: "fixture-instrument-1",
        }).queryKey,
      })
    ).toBeUndefined()

    const projectKey = datasetsQueryOptions(scope, {
      instrumentMfid: "fixture-instrument-1",
      limit: 50,
      projectMfid: "fixture-project-1",
      projectScope: "assigned",
    }).queryKey
    expect(
      datasetInstrumentScopedPreviousData(
        scope,
        "fixture-instrument-1",
        page,
        { queryKey: projectKey },
        "fixture-project-1",
        "assigned"
      )
    ).toBe(page)
    expect(
      datasetInstrumentScopedPreviousData(
        scope,
        "fixture-instrument-1",
        page,
        { queryKey: projectKey },
        "fixture-project-1",
        "shared"
      )
    ).toBeUndefined()
    expect(
      datasetInstrumentScopedPreviousData(
        scope,
        "fixture-instrument-1",
        page,
        {
          queryKey: samplesQueryOptions(scope, {
            limit: 50,
            projectMfid: "fixture-project-1",
            projectScope: "assigned",
          }).queryKey,
        },
        "fixture-project-1",
        "assigned"
      )
    ).toBeUndefined()
  })
})
