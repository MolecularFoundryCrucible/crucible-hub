import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import {
  patchWorkspaceDatasetDescription,
  writeWorkspaceResourceMetadata,
  patchWorkspaceSampleDescription,
  readWorkspaceResource,
} from "./resources.server"

describe("workspace resource sources", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("normalizes the opaque deletion request detail field", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        crucibleApiResponse({
          capabilities: null,
          creation_time: null,
          deletion_request: {
            id: 12,
            requester_id: "user-1",
            resource_mfid: "sample-1",
            status: "pending",
            extra: "discarded",
          },
          description: null,
          links: null,
          modification_time: null,
          owner: null,
          project: null,
          public: false,
          resource_type: "sample",
          sample_name: "Sample",
          sample_type: null,
          scientific_metadata: null,
          timestamp: null,
          unique_id: "sample-1",
        })
      )
    )

    await expect(readWorkspaceResource("sample-1")).resolves.toMatchObject({
      deletion_request: {
        id: 12,
        requester_id: "user-1",
        resource_mfid: "sample-1",
        status: "pending",
      },
    })
  })

  it("patches only supplied sample and dataset descriptive fields and normalizes the responses", async () => {
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
          capabilities: { can_edit: true },
          description: "Updated description",
          modification_time: "2026-09-05T18:45:00Z",
          public: false,
          resource_type: "sample",
          sample_name: "Selected sample",
          sample_type: null,
          timestamp: "2026-09-05T18:45:00Z",
          scientific_metadata: { ignored: true },
          unique_id: "selected-sample",
        })
      })
    )

    const result = await patchWorkspaceSampleDescription("selected-sample", {
      description: "Updated description",
      sample_type: null,
      timestamp: "2026-09-05T18:45:00Z",
    })

    expect(result).toEqual({
      description: "Updated description",
      modification_time: "2026-09-05T18:45:00Z",
      sample_name: "Selected sample",
      sample_type: null,
      timestamp: "2026-09-05T18:45:00Z",
      unique_id: "selected-sample",
    })
    expect(requests).toHaveLength(1)
    expect(requests[0].method).toBe("PATCH")
    expect(new URL(requests[0].url).pathname).toBe("/samples/selected-sample")
    expect(requests[0].headers.get("Authorization")).toBe(
      "Bearer local-test-key"
    )
    await expect(requests[0].json()).resolves.toEqual({
      description: "Updated description",
      sample_type: null,
      timestamp: "2026-09-05T18:45:00Z",
    })

    requests.length = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        return crucibleApiResponse({
          capabilities: { can_edit: true },
          data_format: "NeXus",
          data_type: null,
          dataset_name: null,
          measurement: "X-ray diffraction",
          modification_time: "2026-09-06T01:30:00Z",
          public: false,
          resource_type: "dataset",
          scientific_metadata: { ignored: true },
          session_name: null,
          timestamp: "2026-09-06T01:30:00Z",
          unique_id: "selected-dataset",
        })
      })
    )

    const datasetResult = await patchWorkspaceDatasetDescription(
      "selected-dataset",
      {
        data_type: null,
        dataset_name: "Updated dataset",
        session_name: null,
        timestamp: null,
      }
    )

    expect(datasetResult).toEqual({
      data_format: "NeXus",
      data_type: null,
      dataset_name: "",
      measurement: "X-ray diffraction",
      modification_time: "2026-09-06T01:30:00Z",
      session_name: null,
      timestamp: "2026-09-06T01:30:00Z",
      unique_id: "selected-dataset",
    })
    expect(requests).toHaveLength(1)
    expect(requests[0].method).toBe("PATCH")
    expect(new URL(requests[0].url).pathname).toBe("/datasets/selected-dataset")
    expect(requests[0].headers.get("Authorization")).toBe(
      "Bearer local-test-key"
    )
    await expect(requests[0].json()).resolves.toEqual({
      data_type: null,
      dataset_name: "Updated dataset",
      session_name: null,
      timestamp: null,
    })
  })

  it.each([
    {
      kind: "merge" as const,
      metadata: { sample_preparation: { atmosphere: "argon" } },
      method: "PATCH",
      query: {},
    },
    {
      kind: "replace" as const,
      metadata: { sample_preparation: { atmosphere: "vacuum" } },
      method: "POST",
      query: { overwrite: "true" },
    },
  ])(
    "uses the metadata API $kind operation and normalizes its response",
    async ({ kind, metadata, method, query }) => {
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
            scientific_metadata: {
              acquisition: { energy_ev: { start: 7100 } },
              ...metadata,
            },
            unique_id: "selected-resource",
          })
        })
      )

      await expect(
        writeWorkspaceResourceMetadata("selected-resource", "dataset", {
          kind,
          metadata,
        })
      ).resolves.toEqual({
        scientific_metadata: {
          acquisition: { energy_ev: { start: 7100 } },
          ...metadata,
        },
        unique_id: "selected-resource",
      })
      expect(requests).toHaveLength(1)
      expect(requests[0].method).toBe(method)
      const url = new URL(requests[0].url)
      expect(url.pathname).toBe("/resources/selected-resource/metadata")
      expect(Object.fromEntries(url.searchParams)).toEqual(query)
      expect(requests[0].headers.get("Authorization")).toBe(
        "Bearer local-test-key"
      )
      await expect(requests[0].json()).resolves.toEqual(metadata)
    }
  )

  it("rejects unavailable API configuration and unsafe response bodies", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    await expect(
      writeWorkspaceResourceMetadata("sample-mfid", "sample", {
        kind: "replace",
        metadata: {},
      })
    ).rejects.toThrow("Development API-key access is disabled in production.")

    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => crucibleApiResponse({ unique_id: "x" }))
    )
    await expect(
      writeWorkspaceResourceMetadata("sample-mfid", "sample", {
        kind: "replace",
        metadata: {},
      })
    ).rejects.toThrow("scientific metadata response is invalid")

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        crucibleApiResponse({
          scientific_metadata: {},
          unique_id: "another-mfid",
        })
      )
    )
    await expect(
      writeWorkspaceResourceMetadata("sample-mfid", "sample", {
        kind: "replace",
        metadata: {},
      })
    ).rejects.toThrow("scientific metadata response is invalid")
  })

  it("requests and normalizes canonical instrument detail from the API", async () => {
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
          capabilities: {
            can_change_status: true,
            can_edit: true,
            can_manage_access: false,
            can_transfer: false,
            max_grant_role: "editor",
          },
          creation_time: "2025-11-04T20:00:00Z",
          description: "Scanning hard X-ray microprobe for operando mapping.",
          instrument_id: "hard-xray-microprobe",
          instrument_name: "Hard X-ray Microprobe",
          instrument_type: "X-ray microscope",
          location: "Beamline 5.3.2",
          manufacturer: "Example Instruments",
          model: "XRM-5000",
          modification_time: "2026-08-20T14:25:00Z",
          owner: {
            first_name: "Avery",
            last_name: "Chen",
            unique_id: "0000-0000-0000-000X",
            username: "avery.chen",
          },
          owner_orcid: "0000-0000-0000-000X",
          scientific_metadata: { spatial_resolution_nm: 120 },
          status: "active",
          unique_id: "01J6Y8N4Q2R7M9K3T5V0W1X2Z4",
        })
      })
    )

    const instrument = await readWorkspaceResource("01J6Y8N4Q2R7M9K3T5V0W1X2Z4")

    expect(instrument).toMatchObject({
      capabilities: { can_edit: true, max_grant_role: "editor" },
      instrument_id: "hard-xray-microprobe",
      kind: "instrument",
      owner: { username: "avery.chen" },
      scientific_metadata: { spatial_resolution_nm: 120 },
    })
    expect(requests).toHaveLength(1)
    const url = new URL(requests[0].url)
    expect(url.pathname).toBe("/resources/01J6Y8N4Q2R7M9K3T5V0W1X2Z4")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      include_datasets: "false",
      include_links: "true",
      include_metadata: "true",
      include_owner: "true",
    })
    expect(requests[0]?.headers.get("Authorization")).toBe(
      "Bearer local-test-key"
    )
  })

  it.each([
    { label: "null", links: null, expected: null },
    { label: "empty", links: [], expected: [] },
    {
      label: "populated",
      links: [
        {
          name: null,
          direction: "source",
          relationship_type: "is_derived_from",
          resource_type: "sample",
          unique_id: "parent-sample",
        },
        {
          name: "Child sample",
          direction: "target",
          relationship_type: "is_part_of",
          resource_type: "sample",
          unique_id: "child-sample",
        },
        {
          name: "Linked sample",
          direction: "undirected",
          relationship_type: null,
          resource_type: "sample",
          unique_id: "linked-sample",
        },
      ],
      expected: [
        {
          name: null,
          relationship: "parent",
          relationship_type: "is_derived_from",
          resource_type: "sample",
          unique_id: "parent-sample",
        },
        {
          name: "Child sample",
          relationship: "child",
          relationship_type: "is_part_of",
          resource_type: "sample",
          unique_id: "child-sample",
        },
        {
          name: "Linked sample",
          relationship: "associated",
          relationship_type: null,
          resource_type: "sample",
          unique_id: "linked-sample",
        },
      ],
    },
  ])(
    "preserves $label API relationship availability",
    async ({ links, expected }) => {
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
            dataset_name: "Selected dataset",
            links,
            public: false,
            unique_id: "selected-dataset",
          })
        })
      )

      const detail = await readWorkspaceResource("selected-dataset")

      expect(detail).toMatchObject({ kind: "dataset", links: expected })
      expect(requests).toHaveLength(1)
      const url = new URL(requests[0].url)
      expect(url.pathname).toBe("/resources/selected-dataset")
      expect(Object.fromEntries(url.searchParams)).toEqual({
        include_datasets: "false",
        include_links: "true",
        include_metadata: "true",
        include_owner: "true",
      })
    }
  )

  it("uses links without consuming legacy embedded sample datasets", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        crucibleApiResponse({
          datasets: [
            {
              dataset_name: "Legacy embedded dataset",
              public: false,
              unique_id: "legacy-dataset",
            },
          ],
          links: [
            {
              name: "Authoritative linked dataset",
              direction: "undirected",
              relationship_type: null,
              resource_type: "dataset",
              unique_id: "linked-dataset",
            },
          ],
          project: {
            project_id: "operando-catalyst-mapping",
            title: "Operando Catalyst Mapping",
            unique_id: "selected-project",
          },
          project_id: "stale-project-id",
          public: false,
          sample_name: "Selected sample",
          unique_id: "selected-sample",
        })
      )
    )

    const detail = await readWorkspaceResource("selected-sample")

    expect(detail).toMatchObject({
      kind: "sample",
      links: [
        {
          name: "Authoritative linked dataset",
          unique_id: "linked-dataset",
        },
      ],
      project: {
        project_id: "operando-catalyst-mapping",
        title: "Operando Catalyst Mapping",
        unique_id: "selected-project",
      },
      project_id: "operando-catalyst-mapping",
    })
    expect(detail).not.toHaveProperty("datasets")
  })
})
