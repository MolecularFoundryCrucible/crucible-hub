import { describe, expect, it } from "vitest"

import type {
  WorkspaceResourceGraph,
  WorkspaceResourceGraphEdge,
  WorkspaceResourceGraphNode,
} from "@/data/crucible/workspace-source"

import {
  activeGraphFilterCount,
  filterResourceGraph,
  resolveResourceGraphDisplay,
  resourceGraphDisplaySearchPatch,
} from "./resource-graph-display"

function node(
  unique_id: string,
  kind: "dataset" | "sample"
): WorkspaceResourceGraphNode {
  return {
    context: null,
    dataFormat: null,
    expansionAvailability: {
      ancestors: false,
      associations: false,
      descendants: false,
    },
    hasMoreRelationships: false,
    instrument: null,
    kind,
    name: unique_id,
    project: null,
    traversalDepth: 0,
    unique_id,
  }
}

function edge(
  source: string,
  target: string,
  relationship: "associated" | "parent",
  relationshipType: WorkspaceResourceGraphEdge["relationshipType"] = null
): WorkspaceResourceGraphEdge {
  return {
    directed: relationship === "parent",
    id: `${source}-${target}`,
    relationship,
    relationshipType,
    source,
    target,
  }
}

// root sample S1 -> derived sample S2 -> part-of dataset D1; S1 ~ D2 associated;
// D3 hangs off S2 by an unspecified lineage edge.
const graph: WorkspaceResourceGraph = {
  edgeLimit: 100,
  edges: [
    edge("S1", "S2", "parent", "is_derived_from"),
    edge("S2", "D1", "parent", "is_part_of"),
    edge("S1", "D2", "associated"),
    edge("S2", "D3", "parent"),
  ],
  hasMore: false,
  nodeLimit: 100,
  nodes: [
    node("S1", "sample"),
    node("S2", "sample"),
    node("D1", "dataset"),
    node("D2", "dataset"),
    node("D3", "dataset"),
  ],
  requestedDepth: 3,
  returnedDepth: 2,
  rootMfid: "S1",
  truncated: false,
  truncationReasons: [],
}

const ids = (result: { graph: WorkspaceResourceGraph }) =>
  result.graph.nodes.map((candidate) => candidate.unique_id)

describe("filterResourceGraph", () => {
  it("returns the same graph when nothing is filtered", () => {
    const result = filterResourceGraph(graph, {
      associations: true,
      hidden: [],
    })
    expect(result.graph).toBe(graph)
    expect(result.hiddenCount).toBe(0)
  })

  it("hides datasets but always keeps the current resource", () => {
    const result = filterResourceGraph(graph, {
      associations: true,
      hidden: ["dataset", "sample"],
    })
    expect(ids(result)).toEqual(["S1"])
    expect(result.graph.edges).toEqual([])
    expect(result.hiddenCount).toBe(4)
  })

  it("drops resources that only connect through a hidden one", () => {
    const result = filterResourceGraph(graph, {
      associations: true,
      hidden: ["is_derived_from"],
    })
    expect(ids(result)).toEqual(["S1", "D2"])
    expect(result.hiddenCount).toBe(3)
  })

  it("filters lineage types and treats a missing type as unspecified", () => {
    const result = filterResourceGraph(graph, {
      associations: true,
      hidden: ["unspecified"],
    })
    expect(ids(result)).toEqual(["S1", "S2", "D1", "D2"])
  })

  it("hides associations", () => {
    const result = filterResourceGraph(graph, {
      associations: false,
      hidden: [],
    })
    expect(ids(result)).toEqual(["S1", "S2", "D1", "D3"])
    expect(
      result.graph.edges.some((item) => item.relationship === "associated")
    ).toBe(false)
  })
})

describe("graph display search", () => {
  it("reads hidden values in a stable order and ignores unknown ones", () => {
    const display = resolveResourceGraphDisplay({
      hide: ["unspecified", "dataset"],
    })
    expect(display.hidden).toEqual(["dataset", "unspecified"])
    expect(activeGraphFilterCount(display)).toBe(2)
    expect(
      activeGraphFilterCount({ ...display, associations: false, hidden: [] })
    ).toBe(1)
  })

  it("writes hidden values to the URL and clears them when empty", () => {
    expect(
      resourceGraphDisplaySearchPatch({ hidden: ["is_part_of", "sample"] })
    ).toEqual({ hide: ["sample", "is_part_of"] })
    expect(resourceGraphDisplaySearchPatch({ hidden: [] })).toEqual({
      hide: undefined,
    })
  })
})
