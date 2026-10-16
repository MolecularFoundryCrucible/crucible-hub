import { describe, expect, it } from "vitest"

import {
  applyDataFilters,
  clearDataFilters,
  dataSearchSchema,
  resolveDataFilters,
  setDataFilterProject,
  switchDataKind,
} from "./data-filter-state"

describe("global data filter state", () => {
  it("parses route filters and keeps cursor validation separate", () => {
    expect(
      dataSearchSchema.parse({
        datasetCursor: "dataset-page-2",
        kind: "datasets",
        sampleCursor: { forged: true },
      })
    ).toEqual({
      datasetCursor: "dataset-page-2",
      kind: "datasets",
      sampleCursor: undefined,
    })
    expect(
      resolveDataFilters({
        datasetCursor: "ignored-by-filter-resolution",
        kind: "datasets",
      })
    ).toMatchObject({
      filters: { direction: "desc", kind: "datasets", sort: "created" },
      valid: true,
    })
  })

  it("normalizes defaults for URLs but keeps project All query-ready", () => {
    const resolution = resolveDataFilters({
      kind: "datasets",
      projectMfid: " project-1 ",
      projectScope: "all",
      visibility: "all",
    })
    expect(resolution).toMatchObject({
      filters: {
        direction: "desc",
        kind: "datasets",
        projectMfid: "project-1",
        projectScope: "all",
        sort: "created",
      },
      valid: true,
    })
    if (!resolution.valid) throw new Error("Expected valid filters")
    expect(
      applyDataFilters(
        {
          datasetCursor: "dataset-page-2",
          preview: "fixture-dataset-1",
          sampleCursor: "sample-page-2",
          scenario: "dense",
        },
        resolution.filters
      )
    ).toEqual({
      createdFrom: undefined,
      createdTo: undefined,
      datasetCursor: undefined,
      instrumentMfid: undefined,
      kind: "datasets",
      projectMfid: "project-1",
      projectScope: undefined,
      preview: undefined,
      sampleCursor: undefined,
      scenario: "dense",
      visibility: undefined,
    })
  })

  it("uses preferred default ordering when URL omits sort and preserves explicit overrides", () => {
    const preferred = { direction: "asc" as const, sort: "name" as const }
    const defaultResolution = resolveDataFilters({ kind: "samples" }, preferred)
    expect(defaultResolution).toMatchObject({
      filters: { direction: "asc", kind: "samples", sort: "name" },
      valid: true,
    })
    if (!defaultResolution.valid) throw new Error("Expected valid filters")
    expect(
      applyDataFilters({}, defaultResolution.filters, preferred)
    ).toMatchObject({
      direction: undefined,
      sort: undefined,
    })

    const explicitDefaultResolution = resolveDataFilters(
      { direction: "desc", kind: "samples", sort: "created" },
      preferred
    )
    if (!explicitDefaultResolution.valid)
      throw new Error("Expected valid filters")
    expect(
      applyDataFilters({}, explicitDefaultResolution.filters, preferred)
    ).toMatchObject({
      direction: "desc",
      sort: "created",
    })
  })

  it.each([
    [{ projectScope: "shared" }, "projectScope"],
    [{ instrumentMfid: "instrument-1", kind: "samples" }, "instrumentMfid"],
    [{ instrumentMfid: "instrument-1" }, "instrumentMfid"],
    [{ projectMfid: "" }, "projectMfid"],
    [{ projectMfid: "../private" }, "projectMfid"],
    [{ instrumentMfid: "x".repeat(256), kind: "datasets" }, "instrumentMfid"],
    [{ visibility: "secret" }, "visibility"],
    [{ createdFrom: "2026-02-30" }, "createdFrom"],
    [{ createdFrom: "2026-03-02", createdTo: "2026-03-01" }, "createdTo"],
  ] as const)("rejects invalid filter state %#", (search, field) => {
    const resolution = resolveDataFilters(search)
    expect(resolution.valid).toBe(false)
    if (resolution.valid) throw new Error("Expected invalid filters")
    expect(resolution.errors.map((error) => error.field)).toContain(field)
  })

  it("accepts a dataset instrument and normalizes collection filters", () => {
    expect(
      resolveDataFilters({
        createdFrom: "2026-01-01",
        createdTo: "2026-01-31",
        instrumentMfid: " instrument-1 ",
        kind: "datasets",
        projectMfid: "project-1",
        projectScope: "shared",
        visibility: "public",
      })
    ).toMatchObject({
      filters: {
        createdFrom: "2026-01-01",
        createdTo: "2026-01-31",
        direction: "desc",
        instrumentMfid: "instrument-1",
        kind: "datasets",
        projectMfid: "project-1",
        projectScope: "shared",
        sort: "created",
        visibility: "public",
      },
      valid: true,
    })
  })

  it("clears filters and both cursors while preserving kind and unrelated state", () => {
    expect(
      clearDataFilters({
        createdFrom: "2026-01-01",
        datasetCursor: "dataset-page-2",
        instrumentMfid: "instrument-1",
        kind: "datasets",
        projectMfid: "project-1",
        projectScope: "shared",
        preview: "fixture-dataset-1",
        sampleCursor: "sample-page-2",
        scenario: "dense",
        visibility: "private",
      })
    ).toEqual({
      createdFrom: undefined,
      createdTo: undefined,
      datasetCursor: undefined,
      instrumentMfid: undefined,
      kind: "datasets",
      projectMfid: undefined,
      projectScope: undefined,
      preview: undefined,
      sampleCursor: undefined,
      scenario: "dense",
      visibility: undefined,
    })
  })

  it("clears an invalid kind so malformed URL state can recover", () => {
    expect(
      clearDataFilters({
        kind: "forged",
        preview: "fixture-sample-1",
        projectMfid: "project-1",
      })
    ).toEqual({
      createdFrom: undefined,
      createdTo: undefined,
      datasetCursor: undefined,
      instrumentMfid: undefined,
      kind: undefined,
      projectMfid: undefined,
      projectScope: undefined,
      preview: undefined,
      sampleCursor: undefined,
      visibility: undefined,
    })
  })

  it("clears project scope with the project", () => {
    expect(
      setDataFilterProject(
        { projectMfid: "project-1", projectScope: "shared" },
        "  "
      )
    ).toEqual({ projectMfid: undefined, projectScope: undefined })
  })

  it("resets cursors and instrument when switching away from datasets", () => {
    const previous = {
      datasetCursor: "dataset-page-2",
      instrumentMfid: "instrument-1",
      kind: "datasets",
      preview: "fixture-dataset-1",
      projectMfid: "project-1",
      sampleCursor: "sample-page-2",
    }
    expect(switchDataKind(previous, "samples")).toEqual({
      datasetCursor: undefined,
      instrumentMfid: undefined,
      kind: undefined,
      preview: undefined,
      projectMfid: "project-1",
      sampleCursor: undefined,
    })
    expect(switchDataKind(previous, "datasets")).toEqual({
      datasetCursor: undefined,
      instrumentMfid: "instrument-1",
      kind: "datasets",
      preview: undefined,
      projectMfid: "project-1",
      sampleCursor: undefined,
    })
  })
})
