import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import { mutateWorkspaceRelationship } from "./resource-relationships.server"
import { readWorkspaceResourceGraph } from "./resource-graph.server"

describe("resource graph source", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("uses the typed resource graph endpoint and preserves graph semantics", async () => {
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
          edge_limit: 1_000,
          has_more: true,
          node_limit: 500,
          requested_depth: 1,
          returned_depth: 1,
          root_mfid: "sample-1",
          truncated: false,
          truncation_reasons: [],
          nodes: [
            {
              expansion_availability: {
                associations: false,
                downstream_lineage: false,
                upstream_lineage: false,
              },
              has_more_relationships: false,
              mfid: "sample-1",
              name: "Sample one",
              project: null,
              resource_type: "sample",
              sample_type: "Powder",
              traversal_depth: 0,
            },
            {
              data_format: "nexus",
              expansion_availability: {
                associations: true,
                downstream_lineage: true,
                upstream_lineage: true,
              },
              has_more_relationships: true,
              instrument: null,
              mfid: "dataset-1",
              measurement: "XRD",
              name: "Dataset one",
              project: null,
              resource_type: "dataset",
              traversal_depth: 1,
            },
          ],
          edges: [
            {
              directed: false,
              id: "association:sample:sample-1:dataset:dataset-1",
              kind: "association",
              relationship_type: null,
              source_mfid: "sample-1",
              target_mfid: "dataset-1",
            },
          ],
        })
      })
    )

    await expect(readWorkspaceResourceGraph("sample-1")).resolves.toEqual({
      edgeLimit: 1_000,
      hasMore: true,
      nodeLimit: 500,
      requestedDepth: 1,
      returnedDepth: 1,
      rootMfid: "sample-1",
      truncated: false,
      truncationReasons: [],
      nodes: [
        {
          context: "Powder",
          dataFormat: null,
          expansionAvailability: {
            ancestors: false,
            associations: false,
            descendants: false,
          },
          hasMoreRelationships: false,
          instrument: null,
          kind: "sample",
          name: "Sample one",
          project: null,
          traversalDepth: 0,
          unique_id: "sample-1",
        },
        {
          context: "XRD",
          dataFormat: "nexus",
          expansionAvailability: {
            ancestors: true,
            associations: true,
            descendants: true,
          },
          hasMoreRelationships: true,
          instrument: null,
          kind: "dataset",
          name: "Dataset one",
          project: null,
          traversalDepth: 1,
          unique_id: "dataset-1",
        },
      ],
      edges: [
        {
          directed: false,
          id: "association:sample:sample-1:dataset:dataset-1",
          relationship: "associated",
          relationshipType: null,
          source: "sample-1",
          target: "dataset-1",
        },
      ],
    })
    expect(new URL(requests[0]!.url).pathname).toBe("/resources/sample-1/graph")
    expect(new URL(requests[0]!.url).searchParams.get("depth")).toBe("1")
    expect(new URL(requests[0]!.url).searchParams.get("direction")).toBe("both")

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => crucibleApiResponse({ nodes: [] }))
    )
    await expect(readWorkspaceResourceGraph("sample-1")).rejects.toThrow(
      "resource graph response is invalid"
    )
  })

  it("rejects duplicate stable edge identities", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        crucibleApiResponse({
          edge_limit: 1_000,
          has_more: false,
          node_limit: 500,
          requested_depth: 1,
          returned_depth: 1,
          root_mfid: "sample-1",
          truncated: false,
          truncation_reasons: [],
          nodes: [
            {
              expansion_availability: {
                associations: false,
                downstream_lineage: false,
                upstream_lineage: false,
              },
              has_more_relationships: false,
              mfid: "sample-1",
              name: null,
              project: null,
              resource_type: "sample",
              sample_type: null,
              traversal_depth: 0,
            },
            {
              data_format: null,
              expansion_availability: {
                associations: false,
                downstream_lineage: false,
                upstream_lineage: false,
              },
              has_more_relationships: false,
              instrument: null,
              measurement: null,
              mfid: "dataset-1",
              name: null,
              project: null,
              resource_type: "dataset",
              traversal_depth: 1,
            },
          ],
          edges: [
            {
              directed: false,
              id: "same-edge",
              kind: "association",
              relationship_type: null,
              source_mfid: "sample-1",
              target_mfid: "dataset-1",
            },
            {
              directed: false,
              id: "same-edge",
              kind: "association",
              relationship_type: null,
              source_mfid: "sample-1",
              target_mfid: "dataset-1",
            },
          ],
        })
      )
    )

    await expect(readWorkspaceResourceGraph("sample-1")).rejects.toThrow(
      "resource graph response has duplicate edges"
    )
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
          if (request.method !== "GET") return crucibleApiResponse(1)
          const isDataset = resourceMfid?.startsWith("dataset")
          return crucibleApiResponse(
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
      expect(requests[0]!.method).toBe(method)
      const mutationUrl = new URL(requests[0]!.url)
      expect(mutationUrl.pathname).toBe(path)
      expect(mutationUrl.searchParams.get("relationship_type")).toBe(
        relationshipType
      )
      expect(requests).toHaveLength(3)
    }
  )
})
