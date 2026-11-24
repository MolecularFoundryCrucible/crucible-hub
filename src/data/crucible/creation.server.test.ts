import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

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

  it("creates a project with its owner reference", async () => {
    useApi()
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        return crucibleApiResponse({
          organization: "Molecular Foundry",
          owner: {
            first_name: "Pat",
            last_name: "Lee",
            unique_id: "person-mfid",
          },
          project_id: "perovskite-1",
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
      owner_ref: "person-mfid",
      project_id: "perovskite-1",
      status: "active",
      title: "Perovskite study",
    })
  })

  it("creates samples and datasets with their selected project and instrument MFIDs", async () => {
    useApi()
    const requests: Request[] = []
    const project = {
      project_id: "perovskite-1",
      title: "Study",
      unique_id: "project-mfid",
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        if (new URL(request.url).pathname === "/samples") {
          return crucibleApiResponse({
            description: null,
            project,
            public: false,
            sample_name: "Sample A",
            sample_type: null,
            timestamp: null,
            unique_id: resourceMfid,
          })
        }
        return crucibleApiResponse({
          dataset_name: "Dataset A",
          data_format: null,
          data_type: null,
          instrument: {
            instrument_id: "beamline-1",
            instrument_name: "Beamline 1",
            unique_id: "instrument-mfid",
          },
          measurement: null,
          project,
          public: false,
          session_name: null,
          timestamp: null,
          unique_id: resourceMfid,
        })
      })
    )

    const sample = await createWorkspaceSampleResource({
      description: null,
      projectMfid: "project-mfid",
      public: false,
      sample_name: "Sample A",
      sample_type: null,
      timestamp: null,
    })
    const dataset = await createWorkspaceDatasetResource({
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

    expect(sample).toMatchObject({ kind: "sample", unique_id: resourceMfid })
    expect(dataset).toMatchObject({ kind: "dataset", unique_id: resourceMfid })
    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      "/samples",
      "/datasets",
    ])
    await expect(requests[0].json()).resolves.toEqual({
      description: null,
      project_mfid: "project-mfid",
      public: false,
      sample_name: "Sample A",
      sample_type: null,
      timestamp: null,
    })
    await expect(requests[1].json()).resolves.toEqual({
      data_format: null,
      data_type: null,
      dataset_name: "Dataset A",
      instrument_mfid: "instrument-mfid",
      measurement: null,
      project_mfid: "project-mfid",
      public: false,
      session_name: null,
      timestamp: null,
    })
  })
})
