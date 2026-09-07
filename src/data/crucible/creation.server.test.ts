import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createWorkspaceDatasetResource,
  createWorkspaceProjectResource,
  createWorkspaceSampleResource,
} from "./creation.server"

const resourceMfid = "0swqzb3a1sthv000xd8kta0vrw"

function useApi() {
  vi.stubEnv("NODE_ENV", "development")
  vi.stubEnv("HUB_DATA_SOURCE", "api")
  vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
  vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
}

describe("workspace creation source", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("creates a fixture project led by the selected account", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    const project = await createWorkspaceProjectResource({
      organization: "Molecular Foundry",
      project_id: "fixture-study",
      project_lead: "0000-0000-0000-000X",
      title: "Fixture study",
    })

    expect(project).toMatchObject({
      organization: "Molecular Foundry",
      project_id: "fixture-study",
      project_lead_orcid: "0000-0000-0000-000X",
      status: "active",
      title: "Fixture study",
    })
  })

  it("creates a project with one canonical lead field", async () => {
    useApi()
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        return Response.json({
          organization: "Molecular Foundry",
          project_id: "perovskite-1",
          project_lead_orcid: "person-mfid",
          status: "active",
          title: "Perovskite study",
          unique_id: "project-mfid",
        })
      })
    )

    await createWorkspaceProjectResource({
      organization: "Molecular Foundry",
      project_id: "perovskite-1",
      project_lead: "person-mfid",
      title: "Perovskite study",
    })

    expect(requests).toHaveLength(1)
    expect(new URL(requests[0].url).pathname).toBe("/projects")
    await expect(requests[0].json()).resolves.toEqual({
      organization: "Molecular Foundry",
      project_id: "perovskite-1",
      project_lead: "person-mfid",
      status: "active",
      title: "Perovskite study",
    })
  })

  it("resolves the selected project before creating a sample", async () => {
    useApi()
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        const path = new URL(request.url).pathname
        if (path === "/projects/project-mfid") {
          return Response.json({
            organization: "Molecular Foundry",
            project_id: "perovskite-1",
            unique_id: "project-mfid",
          })
        }
        return Response.json({
          description: null,
          project: {
            project_id: "perovskite-1",
            title: "Study",
            unique_id: "project-mfid",
          },
          public: false,
          sample_name: "Sample A",
          sample_type: null,
          timestamp: null,
          unique_id: resourceMfid,
        })
      })
    )

    const resource = await createWorkspaceSampleResource({
      description: null,
      projectMfid: "project-mfid",
      public: false,
      sample_name: "Sample A",
      sample_type: null,
      timestamp: null,
    })

    expect(resource).toMatchObject({ kind: "sample", unique_id: resourceMfid })
    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      "/projects/project-mfid",
      "/samples",
    ])
    await expect(requests[1].json()).resolves.toEqual({
      description: null,
      project_id: "perovskite-1",
      public: false,
      sample_name: "Sample A",
      sample_type: null,
      timestamp: null,
    })
  })

  it("resolves project and instrument identities before creating a dataset", async () => {
    useApi()
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        const path = new URL(request.url).pathname
        if (path === "/projects/project-mfid") {
          return Response.json({
            organization: "Molecular Foundry",
            project_id: "perovskite-1",
            unique_id: "project-mfid",
          })
        }
        if (path === "/instruments/instrument-mfid") {
          return Response.json({
            instrument_id: "beamline-1",
            instrument_name: "Beamline 1",
            location: "Building 1",
            unique_id: "instrument-mfid",
          })
        }
        return Response.json({
          dataset_name: "Dataset A",
          data_format: null,
          data_type: null,
          instrument: {
            instrument_id: "beamline-1",
            instrument_name: "Beamline 1",
            unique_id: "instrument-mfid",
          },
          measurement: null,
          project: {
            project_id: "perovskite-1",
            title: "Study",
            unique_id: "project-mfid",
          },
          public: false,
          session_name: null,
          timestamp: null,
          unique_id: resourceMfid,
        })
      })
    )

    const resource = await createWorkspaceDatasetResource({
      data_format: null,
      data_type: null,
      dataset_name: "Dataset A",
      instrumentMfid: "instrument-mfid",
      measurement: null,
      projectMfid: "project-mfid",
      public: false,
      session_name: null,
      timestamp: null,
    })

    expect(resource).toMatchObject({ kind: "dataset", unique_id: resourceMfid })
    expect(
      requests.map((request) => new URL(request.url).pathname).sort()
    ).toEqual(
      [
        "/datasets",
        "/instruments/instrument-mfid",
        "/projects/project-mfid",
      ].sort()
    )
    const createRequest = requests.find(
      (request) => new URL(request.url).pathname === "/datasets"
    )
    await expect(createRequest?.json()).resolves.toEqual({
      data_format: null,
      data_type: null,
      dataset_name: "Dataset A",
      instrument_id: "beamline-1",
      measurement: null,
      project_id: "perovskite-1",
      public: false,
      session_name: null,
      timestamp: null,
    })
  })
})
