import { afterEach, describe, expect, it, vi } from "vitest"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"
import { CrucibleResponseError } from "@/server/crucible/request-error.server"

import {
  createWorkspaceFileDownload,
  mutateWorkspaceRelationship,
  requestWorkspaceResourceDeletion,
  patchWorkspaceDatasetDescription,
  writeWorkspaceResourceMetadata,
  patchWorkspaceSampleDescription,
  readWorkspaceDatasetFiles,
  readWorkspaceResource,
  readWorkspaceResourceGraph,
  reassignWorkspaceResourceProject,
  transferWorkspaceResourceOwnership,
} from "./resources.server"

describe("workspace resource sources", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("builds a bounded fixture graph from immediate resource links", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    await expect(
      readWorkspaceResourceGraph("01J6Y8N4Q2R7M9K3T5V0W1X2Z5")
    ).resolves.toMatchObject({
      rootMfid: "01J6Y8N4Q2R7M9K3T5V0W1X2Z5",
      nodes: expect.arrayContaining([
        expect.objectContaining({
          kind: "sample",
          unique_id: "01J6Y8N4Q2R7M9K3T5V0W1X2Z5",
        }),
        expect.objectContaining({
          kind: "dataset",
          unique_id: "01J6Y8N4Q2R7M9K3T5V0W1X2Z7",
        }),
      ]),
      edges: [
        {
          relationship: "associated",
          source: "01J6Y8N4Q2R7M9K3T5V0W1X2Z5",
          target: "01J6Y8N4Q2R7M9K3T5V0W1X2Z7",
        },
      ],
    })
  })

  it("uses the one-hop CTE graph endpoint and validates its opaque response", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        return Response.json({
          directed: true,
          multigraph: false,
          graph: {},
          nodes: [
            {
              id: "sample-1",
              entity_type: "sample",
              name: "Sample one",
              sample_type: "Powder",
            },
            {
              id: "dataset-1",
              entity_type: "dataset",
              measurement: "XRD",
              name: "Dataset one",
            },
          ],
          edges: [{ source: "sample-1", target: "dataset-1" }],
        })
      })
    )

    await expect(readWorkspaceResourceGraph("sample-1")).resolves.toEqual({
      rootMfid: "sample-1",
      nodes: [
        {
          context: "Powder",
          unique_id: "sample-1",
          kind: "sample",
          name: "Sample one",
        },
        {
          context: "XRD",
          unique_id: "dataset-1",
          kind: "dataset",
          name: "Dataset one",
        },
      ],
      edges: [
        {
          relationship: "associated",
          source: "sample-1",
          target: "dataset-1",
        },
      ],
    })
    expect(new URL(requests[0].url).pathname).toBe("/entity_graph_cte/sample-1")
    expect(new URL(requests[0].url).searchParams.get("recursive")).toBe("false")

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ nodes: [] }))
    )
    await expect(readWorkspaceResourceGraph("sample-1")).rejects.toThrow(
      "resource graph response is invalid"
    )
  })

  it("rejects duplicate edges in an opaque graph response", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          directed: true,
          nodes: [
            { id: "sample-1", entity_type: "sample" },
            { id: "dataset-1", entity_type: "dataset" },
          ],
          edges: [
            { source: "sample-1", target: "dataset-1" },
            { source: "sample-1", target: "dataset-1" },
          ],
        })
      )
    )

    await expect(readWorkspaceResourceGraph("sample-1")).rejects.toThrow(
      "resource graph response has duplicate edges"
    )
  })

  it("creates a fixture deletion request without using edit capabilities", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    await expect(
      requestWorkspaceResourceDeletion(
        "01J6Y8N4Q2R7M9K3T5V0W1X2Z5",
        "  no longer needed  "
      )
    ).resolves.toMatchObject({
      reason: "  no longer needed  ",
      resource_id: "01J6Y8N4Q2R7M9K3T5V0W1X2Z5",
      resource_type: "sample",
      status: "pending",
    })
  })

  it("returns exact fixture relationship details with inverse directions without mutating fixtures", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    const result = await mutateWorkspaceRelationship({
      action: "link",
      relationship: "parent",
      relationshipType: "is_part_of",
      sourceKind: "sample",
      sourceMfid: "01J6Y8N4Q2R7M9K3T5V0W1X2Z5",
      targetKind: "sample",
      targetMfid: "01J6Y8N4Q2R7M9K3T5V0W1X2Z6",
    })

    expect(result.source.kind).toBe("sample")
    if (result.source.kind !== "sample") throw new Error("Expected sample")
    expect(result.source.links).toContainEqual(
      expect.objectContaining({
        relationship: "parent",
        relationship_type: "is_part_of",
        unique_id: "01J6Y8N4Q2R7M9K3T5V0W1X2Z6",
      })
    )
    expect(result.target).toMatchObject({
      kind: "sample",
      links: [
        {
          relationship: "child",
          relationship_type: "is_part_of",
          unique_id: "01J6Y8N4Q2R7M9K3T5V0W1X2Z5",
        },
      ],
    })
    await expect(
      readWorkspaceResource("01J6Y8N4Q2R7M9K3T5V0W1X2Z5")
    ).resolves.toMatchObject({ links: [{ relationship: "associated" }] })
  })

  it("does not duplicate fixture relationships and rejects a missing unlink", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")
    const operation = {
      action: "link" as const,
      relationship: "associated" as const,
      sourceKind: "sample" as const,
      sourceMfid: "01J6Y8N4Q2R7M9K3T5V0W1X2Z5",
      targetKind: "dataset" as const,
      targetMfid: "01J6Y8N4Q2R7M9K3T5V0W1X2Z7",
    }

    await expect(mutateWorkspaceRelationship(operation)).resolves.toMatchObject(
      {
        source: { links: [{ unique_id: operation.targetMfid }] },
        target: { links: [{ unique_id: operation.sourceMfid }] },
      }
    )
    const duplicate = await mutateWorkspaceRelationship(operation)
    if (duplicate.source.kind !== "sample") throw new Error("Expected sample")
    expect(
      duplicate.source.links?.filter(
        (link) =>
          link.relationship === operation.relationship &&
          link.unique_id === operation.targetMfid
      )
    ).toHaveLength(1)
    await expect(
      mutateWorkspaceRelationship({
        ...operation,
        action: "unlink",
        relationship: "child",
        targetMfid: "01J6Y8N4Q2R7M9K3T5V0W1X2Z6",
        targetKind: "sample",
      })
    ).rejects.toMatchObject({ status: 404 })
  })

  it.each([
    {
      operation: {
        action: "link",
        relationship: "parent",
        relationshipType: "is_derived_from",
        sourceKind: "sample",
        sourceMfid: "sample-child",
        targetKind: "sample",
        targetMfid: "sample-parent",
      } as const,
      method: "POST",
      path: "/samples/sample-parent/children/sample-child",
      relationshipType: "is_derived_from",
    },
    {
      operation: {
        action: "unlink",
        relationship: "child",
        sourceKind: "dataset",
        sourceMfid: "dataset-parent",
        targetKind: "dataset",
        targetMfid: "dataset-child",
      } as const,
      method: "DELETE",
      path: "/datasets/dataset-parent/children/dataset-child",
      relationshipType: null,
    },
    {
      operation: {
        action: "link",
        relationship: "associated",
        sourceKind: "sample",
        sourceMfid: "sample-1",
        targetKind: "dataset",
        targetMfid: "dataset-1",
      } as const,
      method: "POST",
      path: "/datasets/dataset-1/samples/sample-1",
      relationshipType: null,
    },
  ])(
    "uses the generated $method $path relationship operation",
    async ({ operation, method, path, relationshipType }) => {
      vi.stubEnv("NODE_ENV", "development")
      vi.stubEnv("HUB_DATA_SOURCE", "api")
      vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
      vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
      const requests: Request[] = []
      vi.stubGlobal(
        "fetch",
        vi.fn(async (request: Request) => {
          requests.push(request)
          const resourceMfid = new URL(request.url).pathname.split("/").at(-1)
          if (request.method !== "GET") return Response.json(1)
          const isDataset = resourceMfid?.startsWith("dataset")
          return Response.json(
            isDataset
              ? {
                  capabilities: null,
                  creation_time: null,
                  dataset_name: "Dataset",
                  links: [],
                  modification_time: null,
                  owner: null,
                  project: null,
                  public: false,
                  resource_type: "dataset",
                  scientific_metadata: null,
                  unique_id: resourceMfid,
                }
              : {
                  capabilities: null,
                  creation_time: null,
                  links: [],
                  modification_time: null,
                  owner: null,
                  project: null,
                  public: false,
                  resource_type: "sample",
                  sample_name: "Sample",
                  sample_type: null,
                  scientific_metadata: null,
                  unique_id: resourceMfid,
                }
          )
        })
      )

      const result = await mutateWorkspaceRelationship(operation)
      expect(result.source).toMatchObject({
        kind: operation.sourceKind,
        unique_id: operation.sourceMfid,
      })
      expect(result.target).toMatchObject({
        kind: operation.targetKind,
        unique_id: operation.targetMfid,
      })
      expect(requests[0].method).toBe(method)
      const mutationUrl = new URL(requests[0].url)
      expect(mutationUrl.pathname).toBe(path)
      expect(mutationUrl.searchParams.get("relationship_type")).toBe(
        relationshipType
      )
      expect(requests).toHaveLength(3)
    }
  )

  it("rejects failed API mutations and mismatched post-mutation details", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const operation = {
      action: "link" as const,
      relationship: "associated" as const,
      sourceKind: "sample" as const,
      sourceMfid: "sample-1",
      targetKind: "dataset" as const,
      targetMfid: "dataset-1",
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({}, { status: 403 }))
    )
    await expect(
      safeCrucibleCall("test-correlation", () =>
        mutateWorkspaceRelationship(operation)
      )
    ).resolves.toMatchObject({
      status: "error",
      error: { kind: "forbidden", retryable: false },
    })

    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        if (request.method !== "GET") return Response.json(1)
        return Response.json({
          capabilities: null,
          creation_time: null,
          links: [],
          modification_time: null,
          owner: null,
          project: null,
          public: false,
          resource_type: "sample",
          sample_name: "Sample",
          sample_type: null,
          scientific_metadata: null,
          unique_id: new URL(request.url).pathname.split("/").at(-1),
        })
      })
    )
    await expect(mutateWorkspaceRelationship(operation)).rejects.toThrow(
      "target does not have the expected kind"
    )
  })

  it("normalizes the opaque deletion request detail field", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          capabilities: null,
          creation_time: null,
          deletion_request: {
            id: 12,
            requester_id: "user-1",
            resource_id: "sample-1",
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
        resource_id: "sample-1",
        status: "pending",
      },
    })
  })

  it("posts a deletion request with an optional reason and propagates cancellation", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        return Response.json({
          id: 12,
          project_id: "project-1",
          reason: "cleanup",
          request_time: "2026-09-06T01:00:00Z",
          requester_id: "user-1",
          resource_id: "sample-1",
          resource_name: "Sample",
          resource_type: "sample",
          review_time: null,
          reviewer_id: null,
          reviewer_notes: null,
          status: "pending",
        })
      })
    )

    await expect(
      requestWorkspaceResourceDeletion("sample-1", "cleanup")
    ).resolves.toMatchObject({ id: 12, resource_id: "sample-1" })
    expect(requests[0].method).toBe("POST")
    expect(new URL(requests[0].url).pathname).toBe("/resources/sample-1/delete")
    expect(new URL(requests[0].url).search).toBe("?reason=cleanup")
    expect(requests[0].signal).toBeDefined()
  })

  it("maps an active deletion request conflict and rejects mismatched response identity", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({}, { status: 409 }))
    )
    await expect(
      safeCrucibleCall("test-correlation", () =>
        requestWorkspaceResourceDeletion("sample-1")
      )
    ).resolves.toMatchObject({
      status: "error",
      error: { kind: "conflict", retryable: false },
    })

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          id: 12,
          requester_id: "user-1",
          resource_id: "other-resource",
          status: "pending",
        })
      )
    )
    await expect(requestWorkspaceResourceDeletion("sample-1")).rejects.toThrow(
      "another resource"
    )
  })

  it("resolves discriminated fixture resource detail by canonical MFID", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    const dataset = await readWorkspaceResource("01J6Y8N4Q2R7M9K3T5V0W1X2Z7")
    const sample = await readWorkspaceResource("01J6Y8N4Q2R7M9K3T5V0W1X2Z5")
    const instrument = await readWorkspaceResource("01J6Y8N4Q2R7M9K3T5V0W1X2Z4")
    const project = await readWorkspaceResource("01J6Y8N4Q2R7M9K3T5V0W1X2Z3")

    expect(dataset).toMatchObject({
      capabilities: { can_edit: true },
      instrument_id: "hard-xray-microprobe",
      kind: "dataset",
      measurement: "X-ray absorption spectroscopy",
      name: "NiFe K-edge operando series",
      project_id: "operando-catalyst-mapping",
      links: [
        {
          name: "NiFe oxide catalyst A",
          resource_type: "sample",
          unique_id: "01J6Y8N4Q2R7M9K3T5V0W1X2Z5",
        },
      ],
    })
    expect(sample).toMatchObject({
      capabilities: { can_edit: true },
      kind: "sample",
      name: "NiFe oxide catalyst A",
      project: {
        project_id: "operando-catalyst-mapping",
        title: "Operando Catalyst Mapping",
        unique_id: "01J6Y8N4Q2R7M9K3T5V0W1X2Z3",
      },
      sample_type: "electrocatalyst",
    })
    expect(instrument).toMatchObject({
      capabilities: { can_edit: true },
      instrument_id: "hard-xray-microprobe",
      kind: "instrument",
      name: "Hard X-ray Microprobe",
      other_id: null,
      other_id_source: null,
    })
    expect(project).toMatchObject({
      capabilities: { can_manage_access: true },
      kind: "project",
    })
    await expect(readWorkspaceResource("missing-resource")).resolves.toBeNull()
  })

  it("returns a non-persistent fixture sample descriptive update", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")
    const sampleMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z5"

    await expect(
      patchWorkspaceSampleDescription(sampleMfid, {
        description: null,
        sample_name: "Updated catalyst",
      })
    ).resolves.toEqual({
      description: null,
      modification_time: "2026-08-30T20:15:00Z",
      sample_name: "Updated catalyst",
      sample_type: "electrocatalyst",
      timestamp: "2026-08-27T16:20:00Z",
      unique_id: sampleMfid,
    })
    await expect(readWorkspaceResource(sampleMfid)).resolves.toMatchObject({
      description:
        "Nickel-iron oxide catalyst on carbon paper after activation.",
      name: "NiFe oxide catalyst A",
    })
    await expect(
      safeCrucibleCall("test-correlation", () =>
        patchWorkspaceSampleDescription("missing-sample", {
          description: "Missing",
        })
      )
    ).resolves.toMatchObject({
      error: { kind: "not-found", retryable: false },
      status: "error",
    })
  })

  it("patches only supplied sample descriptive fields and normalizes the response", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        return Response.json({
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
  })

  it("returns a non-persistent fixture dataset descriptive update", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")
    const datasetMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z7"

    await expect(
      patchWorkspaceDatasetDescription(datasetMfid, {
        data_type: null,
        dataset_name: "Updated operando series",
        session_name: "cycle-05",
      })
    ).resolves.toEqual({
      data_format: "HDF5",
      data_type: null,
      dataset_name: "Updated operando series",
      measurement: "X-ray absorption spectroscopy",
      modification_time: "2026-08-30T22:40:00Z",
      session_name: "cycle-05",
      timestamp: "2026-08-28T17:42:00Z",
      unique_id: datasetMfid,
    })
    await expect(readWorkspaceResource(datasetMfid)).resolves.toMatchObject({
      data_type: "spectrum series",
      name: "NiFe K-edge operando series",
      session_name: "operando-cycle-04",
    })
    await expect(
      safeCrucibleCall("test-correlation", () =>
        patchWorkspaceDatasetDescription("missing-dataset", {
          data_type: null,
        })
      )
    ).resolves.toMatchObject({
      error: { kind: "not-found", retryable: false },
      status: "error",
    })
  })

  it("patches only supplied dataset descriptive fields and normalizes the response", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        return Response.json({
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

    const result = await patchWorkspaceDatasetDescription("selected-dataset", {
      data_type: null,
      dataset_name: "Updated dataset",
      session_name: null,
      timestamp: null,
    })

    expect(result).toEqual({
      data_format: "NeXus",
      data_type: null,
      dataset_name: "Untitled dataset",
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

  it("merges fixture scientific metadata without persisting it", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")
    const sampleMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z5"

    await expect(
      writeWorkspaceResourceMetadata(sampleMfid, "sample", {
        kind: "merge",
        metadata: {
          nominal_iron_fraction: 0.25,
          preparation: { temperature_k: 298 },
        },
      })
    ).resolves.toEqual({
      scientific_metadata: {
        electrolyte: "1 M KOH",
        nominal_iron_fraction: 0.25,
        preparation: { temperature_k: 298 },
        substrate: "carbon paper",
      },
      unique_id: sampleMfid,
    })
    await expect(readWorkspaceResource(sampleMfid)).resolves.toMatchObject({
      scientific_metadata: {
        nominal_iron_fraction: 0.2,
      },
    })
  })

  it("replaces fixture scientific metadata and supports clearing it", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")
    const datasetMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z7"

    await expect(
      writeWorkspaceResourceMetadata(datasetMfid, "dataset", {
        kind: "replace",
        metadata: {},
      })
    ).resolves.toEqual({
      scientific_metadata: {},
      unique_id: datasetMfid,
    })
    await expect(readWorkspaceResource(datasetMfid)).resolves.toMatchObject({
      scientific_metadata: {
        acquisition: { edge: "Fe K" },
      },
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
          return Response.json({
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
      vi.fn(async () => Response.json({ unique_id: "x" }))
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
        Response.json({ scientific_metadata: {}, unique_id: "another-mfid" })
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
        return Response.json({
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
    { label: "omitted", links: undefined, expected: null },
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
          return Response.json({
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
        Response.json({
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

  it("returns only file metadata associated with the requested dataset", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    const files = await readWorkspaceDatasetFiles("01J6Y8N4Q2R7M9K3T5V0W1X2Z7")

    expect(files).toHaveLength(2)
    expect(
      files.every((file) => file.dataset_mfid === "01J6Y8N4Q2R7M9K3T5V0W1X2Z7")
    ).toBe(true)
    expect(files[0]).not.toHaveProperty("download_url")
    expect(files[1]).toMatchObject({
      access_note: "Available to project members.",
      storage_backend: "local",
    })
  })

  it("returns deterministic fixture download availability and maps missing files to 404", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    await expect(
      createWorkspaceFileDownload("01J6Y8N4Q2R7M9K3T5V0W1X2ZC")
    ).resolves.toEqual({
      status: "ready",
      url: "https://downloads.crucible.invalid/files/01J6Y8N4Q2R7M9K3T5V0W1X2ZC",
      expiresInSeconds: 3600,
    })
    await expect(
      createWorkspaceFileDownload("01J6Y8N4Q2R7M9K3T5V0W1X2ZD")
    ).resolves.toEqual({ status: "unavailable" })
    await expect(
      createWorkspaceFileDownload("missing-file")
    ).rejects.toMatchObject({ status: 404 })
  })

  it("requests one validated file capability from the API", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const requests: Request[] = []
    const fetch = vi.fn(async (request: Request) => {
      requests.push(request)
      return Response.json({
        expires_in: 3600,
        url: "https://downloads.example.invalid/file",
      })
    })
    vi.stubGlobal("fetch", fetch)

    expect(fetch).not.toHaveBeenCalled()
    await expect(createWorkspaceFileDownload("file-mfid")).resolves.toEqual({
      status: "ready",
      url: "https://downloads.example.invalid/file",
      expiresInSeconds: 3600,
    })

    expect(requests).toHaveLength(1)
    expect(new URL(requests[0].url).pathname).toBe(
      "/files/file-mfid/download_link"
    )
    expect(requests[0].headers.get("Authorization")).toBe(
      "Bearer local-test-key"
    )
  })

  it("normalizes a catalog-only API response to unavailable", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ expires_in: null, url: null }))
    )

    await expect(createWorkspaceFileDownload("file-mfid")).resolves.toEqual({
      status: "unavailable",
    })
  })

  it.each([
    { expires_in: 3600, url: null },
    { expires_in: null, url: "https://downloads.example.invalid/file" },
    { expires_in: 0, url: "https://downloads.example.invalid/file" },
    { expires_in: 1.5, url: "https://downloads.example.invalid/file" },
    { expires_in: 3600, url: "http://downloads.example.invalid/file" },
    { expires_in: 3600, url: "https://user:pass@example.invalid/file" },
    { expires_in: 3600, url: "not-an-absolute-url" },
    { expires_in: 3600, url: " https://downloads.example.invalid/file" },
    {
      expires_in: 3600,
      extra: true,
      url: "https://downloads.example.invalid/file",
    },
  ])("maps malformed API capability %# to unexpected", async (payload) => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(payload))
    )

    const result = await safeCrucibleCall("test-correlation", () =>
      createWorkspaceFileDownload("file-mfid")
    )

    expect(result).toMatchObject({
      status: "error",
      error: { kind: "unexpected", retryable: true },
    })
  })

  it("maps an upstream missing file response to not found", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({}, { status: 404 }))
    )

    const result = await safeCrucibleCall("test-correlation", () =>
      createWorkspaceFileDownload("missing-file")
    )

    expect(result).toMatchObject({
      status: "error",
      error: { kind: "not-found", retryable: false },
    })
    await expect(
      createWorkspaceFileDownload("missing-file")
    ).rejects.toBeInstanceOf(CrucibleResponseError)
  })

  it("resolves dense fixture instrument and dataset links", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    const instrument = await readWorkspaceResource(
      "fixture-instrument-1",
      "dense"
    )
    const dataset = await readWorkspaceResource("fixture-dataset-51", "dense")

    expect(instrument).toMatchObject({
      kind: "instrument",
      name: "High-resolution operando hard X-ray microprobe instrument",
      unique_id: "fixture-instrument-1",
    })
    expect(dataset).toMatchObject({
      instrument: { unique_id: "fixture-instrument-1" },
      kind: "dataset",
      unique_id: "fixture-dataset-51",
    })
  })

  it("provides branching, cyclic, unnamed, unavailable, and empty relationships", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    const sample = await readWorkspaceResource("fixture-sample-1", "dense")
    const parent = await readWorkspaceResource("fixture-sample-2", "dense")
    const unavailable = await readWorkspaceResource("fixture-sample-3", "dense")
    const empty = await readWorkspaceResource("fixture-sample-4", "dense")
    const dataset = await readWorkspaceResource("fixture-dataset-1", "dense")

    expect(sample).toMatchObject({
      kind: "sample",
      links: [
        {
          relationship: "parent",
          unique_id: "fixture-sample-2",
        },
        {
          name: null,
          relationship: "child",
          unique_id: "fixture-sample-3",
        },
        {
          relationship: "associated",
          unique_id: "fixture-dataset-1",
        },
      ],
    })
    expect(parent).toMatchObject({
      links: [
        {
          relationship: "child",
          unique_id: "fixture-sample-1",
        },
      ],
    })
    expect(dataset).toMatchObject({
      links: [
        {
          relationship: "associated",
          unique_id: "fixture-sample-1",
        },
      ],
    })
    expect(unavailable).toMatchObject({ links: null })
    expect(empty).toMatchObject({ links: [] })
  })

  it("does not bypass the production fixture guard", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("HUB_DATA_SOURCE", "")
    vi.stubEnv("HUB_ENABLE_FIXTURES", "")

    await expect(
      readWorkspaceResource("01J6Y8N4Q2R7M9K3T5V0W1X2Z7")
    ).rejects.toThrow("The Crucible API login exchange is not connected yet.")
  })

  it("previews and confirms ownership through the same resource operation", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        return Response.json({
          new_owner: {
            first_name: "Morgan",
            last_name: "Lee",
            unique_id: "person-mfid",
          },
          resource_id: "resource-mfid",
        })
      })
    )

    await transferWorkspaceResourceOwnership(
      "resource-mfid",
      "person-mfid",
      false
    )
    await transferWorkspaceResourceOwnership(
      "resource-mfid",
      "person-mfid",
      true
    )

    expect(
      requests.map((request) =>
        Object.fromEntries(new URL(request.url).searchParams)
      )
    ).toEqual([{ confirm: "false" }, { confirm: "true" }])
    await expect(requests[0].json()).resolves.toEqual({
      new_owner: "person-mfid",
    })
  })

  it("resolves a project MFID before previewing a project move by slug", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        const path = new URL(request.url).pathname
        if (path === "/projects/project-mfid") {
          return Response.json({
            organization: "Example Laboratory",
            project_id: "project-slug",
            project_lead_orcid: "person-mfid",
            unique_id: "project-mfid",
          })
        }
        return Response.json({
          new_project_id: "project-slug",
          resource_id: "resource-mfid",
        })
      })
    )

    await reassignWorkspaceResourceProject(
      "resource-mfid",
      "project-mfid",
      false
    )

    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      "/projects/project-mfid",
      "/resources/resource-mfid/project",
    ])
    expect(Object.fromEntries(new URL(requests[1].url).searchParams)).toEqual({
      confirm: "false",
    })
    await expect(requests[1].json()).resolves.toEqual({
      project_id: "project-slug",
    })
  })
})
