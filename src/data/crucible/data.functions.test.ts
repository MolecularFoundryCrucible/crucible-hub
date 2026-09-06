import { describe, expect, it } from "vitest"

import {
  cursorPageInputSchema,
  datasetCursorPageInputSchema,
} from "./data.functions"

describe("dataset server function input", () => {
  it("keeps instrument filtering out of the sample input schema", () => {
    expect(
      cursorPageInputSchema.parse({
        instrumentMfid: "fixture-instrument-1",
        limit: 50,
      })
    ).toEqual({ limit: 50 })
  })

  it("trims and bounds the optional instrument MFID", () => {
    expect(
      datasetCursorPageInputSchema.parse({
        instrumentMfid: " fixture-instrument-1 ",
        limit: 50,
      }).instrumentMfid
    ).toBe("fixture-instrument-1")
    expect(() =>
      datasetCursorPageInputSchema.parse({ instrumentMfid: " ", limit: 50 })
    ).toThrow()
  })

  it("requires a project MFID for scoped requests and defaults project reads to all", () => {
    expect(
      cursorPageInputSchema.parse({
        limit: 50,
        projectMfid: " fixture-project-1 ",
      })
    ).toMatchObject({
      projectMfid: "fixture-project-1",
      projectScope: "all",
    })
    expect(
      datasetCursorPageInputSchema.safeParse({
        limit: 50,
        projectScope: "shared",
      }).success
    ).toBe(false)
  })

  it("accepts each supported project scope", () => {
    for (const projectScope of ["all", "assigned", "shared"] as const) {
      expect(
        datasetCursorPageInputSchema.parse({
          limit: 50,
          projectMfid: "fixture-project-1",
          projectScope,
        }).projectScope
      ).toBe(projectScope)
    }
  })

  it("validates and normalizes collection filters", () => {
    expect(
      cursorPageInputSchema.parse({
        createdFrom: "2024-02-29",
        createdTo: "2024-03-01",
        limit: 50,
        visibility: "all",
      })
    ).toEqual({
      createdFrom: "2024-02-29",
      createdTo: "2024-03-01",
      limit: 50,
    })
    expect(
      cursorPageInputSchema.safeParse({
        createdFrom: "2026-02-30",
        limit: 50,
      }).success
    ).toBe(false)
    expect(
      datasetCursorPageInputSchema.safeParse({
        createdFrom: "2026-09-02",
        createdTo: "2026-09-01",
        limit: 50,
      }).success
    ).toBe(false)
  })
})
