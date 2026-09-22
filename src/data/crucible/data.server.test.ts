import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import { readWorkspaceDatasets, readWorkspaceSamples } from "./data.server"
import { demoWorkspace } from "./fixtures/demo-workspace"

describe("workspace data sources", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("uses opaque cursor pagination for fixture samples", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    const first = await readWorkspaceSamples({ limit: 1 })
    const second = await readWorkspaceSamples({
      cursor: first.nextCursor ?? undefined,
      limit: 1,
    })

    expect(first.items).toHaveLength(1)
    expect(first.total).toBe(2)
    expect(first.nextCursor).toBe("fixture:1")
    expect(second.items).toHaveLength(1)
    expect(second.total).toBeNull()
    expect(second.nextCursor).toBeNull()
  })

  it("uses independent cursor pagination for fixture datasets", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    const first = await readWorkspaceDatasets({ limit: 2 })
    const second = await readWorkspaceDatasets({
      cursor: first.nextCursor ?? undefined,
      limit: 2,
    })

    expect(first.items).toHaveLength(2)
    expect(first.items.map((dataset) => dataset.unique_id)).toEqual([
      "01J6Y8N4Q2R7M9K3T5V0W1X2Z9",
      "01J6Y8N4Q2R7M9K3T5V0W1X2Z8",
    ])
    expect(first.total).toBe(3)
    expect(first.nextCursor).toBe("fixture:2")
    expect(second.items).toHaveLength(1)
    expect(second.items[0]?.unique_id).toBe("01J6Y8N4Q2R7M9K3T5V0W1X2Z7")
    expect(second.total).toBeNull()
    expect(second.nextCursor).toBeNull()
    expect(demoWorkspace.datasets.map((dataset) => dataset.unique_id)).toEqual([
      "01J6Y8N4Q2R7M9K3T5V0W1X2Z7",
      "01J6Y8N4Q2R7M9K3T5V0W1X2Z8",
      "01J6Y8N4Q2R7M9K3T5V0W1X2Z9",
    ])
  })

  it("rejects cursors that were not issued by the fixture source", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    await expect(
      readWorkspaceSamples({ cursor: "invalid", limit: 1 })
    ).rejects.toThrow("The fixture cursor is invalid.")
  })

  it("filters dense datasets by expanded instrument before cursor paging", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    const first = await readWorkspaceDatasets({
      limit: 50,
      instrumentMfid: "fixture-instrument-1",
      scenario: "dense",
    })
    const second = await readWorkspaceDatasets({
      cursor: first.nextCursor ?? undefined,
      limit: 50,
      instrumentMfid: "fixture-instrument-1",
      scenario: "dense",
    })
    const secondary = await readWorkspaceDatasets({
      limit: 50,
      instrumentMfid: "fixture-instrument-2",
      scenario: "dense",
    })

    expect(first.items).toHaveLength(50)
    expect(
      first.items.every(
        (dataset) => dataset.instrument?.unique_id === "fixture-instrument-1"
      )
    ).toBe(true)
    expect(second.items).toHaveLength(4)
    expect(
      second.items.every(
        (dataset) => dataset.instrument?.unique_id === "fixture-instrument-1"
      )
    ).toBe(true)
    expect(first.total).toBe(54)
    expect(second.nextCursor).toBeNull()
    expect(secondary.items.map((dataset) => dataset.unique_id)).toEqual([
      "fixture-dataset-55",
      "fixture-dataset-56",
    ])
    await expect(
      readWorkspaceDatasets({
        limit: 50,
        instrumentMfid: "missing-instrument",
        scenario: "dense",
      })
    ).resolves.toMatchObject({ items: [], total: 0, nextCursor: null })
  })

  it("filters explicit fixture project relationships before cursor paging", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    const assigned = await readWorkspaceSamples({
      limit: 2,
      projectMfid: "fixture-project-1",
      projectScope: "assigned",
      scenario: "dense",
    })
    const shared = await readWorkspaceSamples({
      limit: 50,
      projectMfid: "fixture-project-1",
      projectScope: "shared",
      scenario: "dense",
    })
    const all = await readWorkspaceDatasets({
      limit: 50,
      projectMfid: "fixture-project-1",
      scenario: "dense",
    })

    expect(assigned.items.map((sample) => sample.unique_id)).toEqual([
      "fixture-sample-1",
      "fixture-sample-4",
    ])
    expect(
      assigned.items.every((sample) => sample.project_relation === "assigned")
    ).toBe(true)
    expect(assigned.total).toBe(4)
    expect(assigned.nextCursor).toBe("fixture:2")
    expect(shared.items).toMatchObject([
      {
        unique_id: "fixture-sample-2",
        project: { unique_id: "fixture-project-2" },
        project_relation: "shared",
      },
      {
        unique_id: "fixture-sample-3",
        project: null,
        project_relation: "shared",
      },
    ])
    expect(all.items.map((dataset) => dataset.unique_id)).not.toContain(
      "fixture-dataset-5"
    )
    expect(
      all.items.find((dataset) => dataset.unique_id === "fixture-dataset-2")
    ).toMatchObject({
      project: { unique_id: "fixture-project-2" },
      project_relation: "shared",
    })
    expect(
      all.items.find((dataset) => dataset.unique_id === "fixture-dataset-3")
    ).toMatchObject({ project: null, project_relation: "shared" })
  })

  it("combines collection filters with project and instrument filters before paging", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    const assignedSamples = await readWorkspaceSamples({
      createdFrom: "2026-08-27",
      createdTo: "2026-08-27",
      limit: 2,
      projectMfid: "fixture-project-1",
      projectScope: "assigned",
      scenario: "dense",
      visibility: "public",
    })
    const sharedDatasets = await readWorkspaceDatasets({
      createdFrom: "2026-08-30",
      createdTo: "2026-08-30",
      instrumentMfid: "fixture-instrument-1",
      limit: 50,
      projectMfid: "fixture-project-1",
      projectScope: "shared",
      scenario: "dense",
      visibility: "public",
    })

    expect(assignedSamples.items.map((sample) => sample.unique_id)).toEqual([
      "fixture-sample-1",
      "fixture-sample-25",
    ])
    expect(assignedSamples.total).toBe(3)
    expect(assignedSamples.nextCursor).toBe("fixture:2")
    expect(sharedDatasets.items).toMatchObject([
      {
        project: null,
        project_relation: "shared",
        public: true,
        unique_id: "fixture-dataset-3",
      },
    ])
  })

  it("prefers expanded dataset references over flat identifiers", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        crucibleApiResponse({
          items: [
            {
              dataset_name: "Reference precedence",
              instrument: {
                instrument_id: "expanded-instrument",
                instrument_name: "Expanded instrument",
                unique_id: "instrument-mfid",
              },
              instrument_id: "flat-instrument",
              project: {
                project_id: "expanded-project",
                title: "Expanded project",
                unique_id: "project-mfid",
              },
              project_id: "flat-project",
              project_relation: "shared",
              public: false,
              resource_type: "dataset",
              unique_id: "dataset-mfid",
            },
          ],
          limit: 50,
          next_cursor: null,
          total: 1,
        })
      )
    )

    const page = await readWorkspaceDatasets({ limit: 50 })

    expect(page.items[0]).toMatchObject({
      instrument_id: "expanded-instrument",
      instrument: {
        instrument_name: "Expanded instrument",
        unique_id: "instrument-mfid",
      },
      project_id: "expanded-project",
      project: {
        title: "Expanded project",
        unique_id: "project-mfid",
      },
      project_relation: "shared",
      public: false,
    })
  })

  it("preserves expanded sample projects and normalizes omitted relations", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        crucibleApiResponse({
          items: [
            {
              project: {
                project_id: "actual-project",
                title: "Actual project",
                unique_id: "actual-project-mfid",
              },
              project_id: "stale-flat-project",
              public: false,
              sample_name: "Shared sample",
              unique_id: "sample-mfid",
            },
          ],
          limit: 50,
          next_cursor: null,
          total: 1,
        })
      )
    )

    const page = await readWorkspaceSamples({ limit: 50 })

    expect(page.items[0]).toMatchObject({
      project: {
        project_id: "actual-project",
        unique_id: "actual-project-mfid",
      },
      project_id: "actual-project",
      project_relation: null,
      public: false,
    })
  })

  it("forwards an instrument MFID while leaving global requests unfiltered", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        return crucibleApiResponse({
          items: [],
          limit: 50,
          next_cursor: null,
          total: 0,
        })
      })
    )

    await readWorkspaceDatasets({ limit: 50 })
    await readWorkspaceDatasets({
      createdFrom: "2026-08-27",
      createdTo: "2026-08-29",
      limit: 50,
      instrumentMfid: "fixture-instrument-1",
      visibility: "public",
    })
    await readWorkspaceSamples({
      createdFrom: "2026-08-27",
      createdTo: "2026-08-27",
      limit: 50,
      projectMfid: "fixture-project-1",
      visibility: "private",
    })
    await readWorkspaceDatasets({
      limit: 50,
      projectMfid: "fixture-project-1",
      projectScope: "shared",
    })

    const requestQueries = requests.map(
      (request) => new URL(request.url).searchParams
    )
    expect(requestQueries[0]?.has("instrument_mfid")).toBe(false)
    expect(requestQueries[0]?.has("project_mfid")).toBe(false)
    expect(requestQueries[0]?.has("visibility")).toBe(false)
    expect(requestQueries[0]?.has("creation_time_gte")).toBe(false)
    expect(requestQueries[1]?.get("instrument_mfid")).toBe(
      "fixture-instrument-1"
    )
    expect(requestQueries[1]?.has("project_mfid")).toBe(false)
    expect(requestQueries[1]?.get("visibility")).toBe("public")
    expect(requestQueries[1]?.get("creation_time_gte")).toBe(
      "2026-08-27T00:00:00+00:00"
    )
    expect(requestQueries[1]?.get("creation_time_lte")).toBe(
      "2026-08-29T23:59:59.999999+00:00"
    )
    expect(requestQueries[2]?.get("project_mfid")).toBe("fixture-project-1")
    expect(requestQueries[2]?.get("project_scope")).toBe("all")
    expect(requestQueries[2]?.get("visibility")).toBe("private")
    expect(requestQueries[2]?.get("creation_time_gte")).toBe(
      "2026-08-27T00:00:00+00:00"
    )
    expect(requestQueries[2]?.get("creation_time_lte")).toBe(
      "2026-08-27T23:59:59.999999+00:00"
    )
    expect(requestQueries[3]?.get("project_mfid")).toBe("fixture-project-1")
    expect(requestQueries[3]?.get("project_scope")).toBe("shared")
  })

  it("rejects explicit blank instrument filters at the direct server boundary", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    await expect(
      readWorkspaceDatasets({ instrumentMfid: " ", limit: 50 })
    ).rejects.toThrow("The instrument MFID must contain 1 to 255 characters.")
  })
})
