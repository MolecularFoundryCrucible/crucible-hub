import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import {
  readWorkspaceDatasetFacets,
  readWorkspaceDatasets,
  readWorkspaceSamples,
} from "./data.server"

const viewer = vi.hoisted(() => ({ timeZone: "UTC" }))
vi.mock("@/server/crucible/time-zone.server", () => ({
  viewerTimeZone: () => viewer.timeZone,
}))

describe("workspace data sources", () => {
  afterEach(() => {
    viewer.timeZone = "UTC"
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("sends creation date filters as the viewer's local day in UTC", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    viewer.timeZone = "America/Los_Angeles"
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

    await readWorkspaceDatasets({
      createdFrom: "2026-10-18",
      createdTo: "2026-10-18",
      limit: 50,
    })

    const query = new URL(requests[0]!.url).searchParams
    expect(query.get("creation_time_gte")).toBe("2026-10-18T07:00:00.000Z")
    expect(query.get("creation_time_lte")).toBe("2026-10-19T06:59:59.999999Z")
  })

  it("sends the member affiliation to the API", async () => {
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

    await readWorkspaceDatasets({ affiliation: "member", limit: 50 })

    expect(
      new URL(requests[0]!.url).searchParams.getAll("affiliation")
    ).toEqual(["member"])
  })

  it("adds instrument access to the member affiliation only when asked", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        return crucibleApiResponse(
          new URL(request.url).pathname.endsWith("/facets")
            ? { field: "measurement", items: [], limit: 100, next_cursor: null }
            : { items: [], limit: 50, next_cursor: null, total: 0 }
        )
      })
    )

    await readWorkspaceDatasets({
      affiliation: "member",
      includeInstrumentAccess: true,
      instrumentMfid: "instrument-mfid",
      limit: 50,
    })
    await readWorkspaceDatasets({
      affiliation: "owner",
      includeInstrumentAccess: true,
      limit: 50,
    })
    await readWorkspaceDatasets({ includeInstrumentAccess: true, limit: 50 })
    await readWorkspaceDatasetFacets({
      affiliation: "member",
      field: "measurement",
      includeInstrumentAccess: true,
      limit: 100,
    })

    expect(
      requests.map((request) =>
        new URL(request.url).searchParams.getAll("affiliation")
      )
    ).toEqual([
      ["member", "instrument"],
      ["owner"],
      [],
      ["member", "instrument"],
    ])
  })

  it("prefers expanded references over flat identifiers", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) =>
        crucibleApiResponse({
          items: new URL(request.url).pathname.startsWith("/samples")
            ? [
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
              ]
            : [
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

    const samples = await readWorkspaceSamples({ limit: 50 })

    expect(samples.items[0]).toMatchObject({
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
      "2026-08-27T00:00:00.000Z"
    )
    expect(requestQueries[1]?.get("creation_time_lte")).toBe(
      "2026-08-29T23:59:59.999999Z"
    )
    expect(requestQueries[2]?.get("project_mfid")).toBe("fixture-project-1")
    expect(requestQueries[2]?.get("project_scope")).toBe("all")
    expect(requestQueries[2]?.get("visibility")).toBe("private")
    expect(requestQueries[2]?.get("creation_time_gte")).toBe(
      "2026-08-27T00:00:00.000Z"
    )
    expect(requestQueries[2]?.get("creation_time_lte")).toBe(
      "2026-08-27T23:59:59.999999Z"
    )
    expect(requestQueries[3]?.get("project_mfid")).toBe("fixture-project-1")
    expect(requestQueries[3]?.get("project_scope")).toBe("shared")
  })

  it("rejects explicit blank instrument filters at the direct server boundary", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")

    await expect(
      readWorkspaceDatasets({ instrumentMfid: " ", limit: 50 })
    ).rejects.toThrow("The instrument MFID must contain 1 to 255 characters.")
  })
})
