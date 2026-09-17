import { describe, expect, it } from "vitest"

import type {
  WorkspaceResourceGraph,
  WorkspaceResourceGraphEdge,
  WorkspaceResourceGraphNode,
} from "@/data/crucible/workspace-source"

import { mergeResourceGraphs } from "./resource-graph-merge"

describe("resource graph expansion merge", () => {
  it("deduplicates stable identities and preserves rooted completeness", () => {
    const firstEdge = edge("edge-a-b", "sample-a", "sample-b")
    const rootGraph = graph(
      "sample-a",
      [node("sample-a", 0, false), node("sample-b", 1, true)],
      [firstEdge]
    )
    const expansionGraph = graph(
      "sample-b",
      [
        node("sample-b", 0, false),
        node("sample-a", 1, true),
        node("sample-c", 1, true),
      ],
      [firstEdge, edge("edge-b-c", "sample-b", "sample-c")]
    )

    const result = mergeResourceGraphs(rootGraph, [expansionGraph])

    expect(result.edges.map((candidate) => candidate.id)).toEqual([
      "edge-a-b",
      "edge-b-c",
    ])
    expect(result.nodes).toHaveLength(3)
    expect(
      result.nodes.find((candidate) => candidate.unique_id === "sample-a")
        ?.hasMoreRelationships
    ).toBe(false)
    expect(
      result.nodes.find((candidate) => candidate.unique_id === "sample-b")
        ?.hasMoreRelationships
    ).toBe(false)
    expect(
      result.nodes.find((candidate) => candidate.unique_id === "sample-c")
        ?.traversalDepth
    ).toBe(2)
  })
})

function node(
  uniqueId: string,
  traversalDepth: number,
  hasMoreRelationships: boolean
): WorkspaceResourceGraphNode {
  return {
    context: null,
    dataFormat: null,
    hasMoreRelationships,
    instrument: null,
    kind: "sample",
    name: uniqueId,
    project: null,
    traversalDepth,
    unique_id: uniqueId,
  }
}

function edge(
  id: string,
  source: string,
  target: string
): WorkspaceResourceGraphEdge {
  return {
    directed: true,
    id,
    relationship: "parent",
    relationshipType: null,
    source,
    target,
  }
}

function graph(
  rootMfid: string,
  nodes: readonly WorkspaceResourceGraphNode[],
  edges: readonly WorkspaceResourceGraphEdge[]
): WorkspaceResourceGraph {
  return {
    edgeLimit: 1_000,
    edges,
    hasMore: nodes.some((candidate) => candidate.hasMoreRelationships),
    nodeLimit: 500,
    nodes,
    requestedDepth: 1,
    returnedDepth: nodes.length > 1 ? 1 : 0,
    rootMfid,
    truncated: false,
    truncationReasons: [],
  }
}
