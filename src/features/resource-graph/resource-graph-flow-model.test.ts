import { describe, expect, it, vi } from "vitest"

import type {
  WorkspaceResourceGraph,
  WorkspaceResourceGraphNode,
} from "@/data/crucible/workspace-source"

import {
  presentResourceFlowNodes,
  reconcileResourceFlowNodes,
} from "./resource-graph-flow-model"
import type { ResourceFlowNodePresentation } from "./resource-graph-flow-model"

function node(unique_id: string): WorkspaceResourceGraphNode {
  return {
    context: null,
    dataFormat: null,
    expansionAvailability: {
      ancestors: unique_id === "b",
      associations: false,
      descendants: false,
    },
    hasMoreRelationships: unique_id === "b",
    instrument: null,
    kind: "sample",
    name: unique_id,
    project: null,
    traversalDepth: unique_id === "a" ? 0 : 1,
    unique_id,
  }
}

const graph: WorkspaceResourceGraph = {
  edgeLimit: 10,
  edges: [],
  hasMore: false,
  nodeLimit: 10,
  nodes: [node("a"), node("b"), node("c")],
  requestedDepth: 1,
  returnedDepth: 1,
  rootMfid: "a",
  truncated: false,
  truncationReasons: [],
}

const onExpand = vi.fn()

function presentation(
  changes: Partial<ResourceFlowNodePresentation> = {}
): ResourceFlowNodePresentation {
  return {
    activeHighlightMfid: null,
    activeNeighbours: undefined,
    displayThumbnails: true,
    expansionModesByNode: new Map([["b", ["ancestors"]]]),
    expansionStates: new Map(),
    inspectedMfid: null,
    layoutDirection: "DOWN",
    onExpand,
    rootContext: null,
    thumbnails: {},
    ...changes,
  }
}

const positions = new Map(
  ["a", "b", "c"].map((id, index) => [
    id,
    { height: 80, width: 240, x: index * 300, y: 0 },
  ])
)

describe("presentResourceFlowNodes", () => {
  it("keeps the array when nothing changed", () => {
    const nodes = reconcileResourceFlowNodes(
      [],
      graph,
      positions,
      presentation(),
      new Set()
    )
    expect(presentResourceFlowNodes(nodes, graph, presentation())).toBe(nodes)
  })

  it("replaces only the nodes whose presentation changed", () => {
    const nodes = reconcileResourceFlowNodes(
      [],
      graph,
      positions,
      presentation(),
      new Set()
    )
    const hovered = presentResourceFlowNodes(
      nodes,
      graph,
      presentation({
        activeHighlightMfid: "a",
        activeNeighbours: new Set(["a", "b"]),
      })
    )
    expect(hovered[0]).not.toBe(nodes[0])
    expect(hovered[0].data.highlighted).toBe(true)
    expect(hovered[1]).toBe(nodes[1])
    expect(hovered[2]).not.toBe(nodes[2])
    expect(hovered[2].data.dimmed).toBe(true)
  })

  it("gives each node only its own expansion state", () => {
    const nodes = reconcileResourceFlowNodes(
      [],
      graph,
      positions,
      presentation(),
      new Set()
    )
    expect(nodes[1].data.expansions).toEqual([
      { mode: "ancestors", status: "idle" },
    ])
    const pending = presentResourceFlowNodes(
      nodes,
      graph,
      presentation({
        expansionStates: new Map([
          [
            "b:ancestors",
            {
              isError: false,
              isFetching: true,
              isPending: true,
              isSuccess: false,
              refetch: vi.fn(),
            },
          ],
        ]),
      })
    )
    expect(pending[1].data.expansions).toEqual([
      { mode: "ancestors", status: "pending" },
    ])
    expect(pending[0]).toBe(nodes[0])
    expect(pending[2]).toBe(nodes[2])
  })
})
