import { describe, expect, it, vi } from "vitest"

import type {
  WorkspaceResourceGraph,
  WorkspaceResourceGraphEdge,
  WorkspaceResourceGraphNode,
} from "@/data/crucible/workspace-source"

import {
  fallbackResourceGraphLayout,
  layoutResourceGraph,
  resetResourceGraphLayoutEngine,
  resolveAssociationHandleIds,
  resolveGraphNodeClickAction,
} from "./resource-graph-canvas"
import {
  graphRelationshipOrder,
  graphRelationshipPresentations,
} from "./resource-graph-page"

function createMockNode(
  uniqueId: string,
  kind: "dataset" | "sample" = "sample"
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
    name: uniqueId,
    project: null,
    traversalDepth: 0,
    unique_id: uniqueId,
  }
}

function createMockEdge(
  id: string,
  source: string,
  target: string,
  relationship: "associated" | "parent" = "parent"
): WorkspaceResourceGraphEdge {
  return {
    directed: relationship === "parent",
    id,
    relationship,
    relationshipType: null,
    source,
    target,
  }
}

function createMockGraph(
  rootMfid: string,
  nodes: readonly WorkspaceResourceGraphNode[],
  edges: readonly WorkspaceResourceGraphEdge[] = []
): WorkspaceResourceGraph {
  return {
    edgeLimit: 1_000,
    edges,
    hasMore: false,
    nodeLimit: 500,
    nodes,
    requestedDepth: 1,
    returnedDepth: 1,
    rootMfid,
    truncated: false,
    truncationReasons: [],
  }
}

function createMockElement(tokenValues: Record<string, string> = {}) {
  const defaultTokens: Record<string, string> = {
    "--graph-layout-duration": "300",
    "--graph-layout-layer-gap": "80",
    "--graph-layout-node-gap": "40",
    "--graph-node-height": "100",
    "--graph-node-width": "220",
    "--graph-root-node-height": "120",
    "--graph-root-node-width": "260",
  }
  const tokens = { ...defaultTokens, ...tokenValues }

  const element = document.createElement("div")
  vi.spyOn(window, "getComputedStyle").mockImplementation(
    () =>
      ({
        getPropertyValue: (prop: string) => tokens[prop] ?? "",
      }) as CSSStyleDeclaration
  )
  return element
}

describe("resource graph fallback layout", () => {
  it("computes horizontal fallback positions with offset from root", () => {
    const rootNode = createMockNode("root-sample")
    const childNode = createMockNode("child-sample")
    const testGraph = createMockGraph("root-sample", [rootNode, childNode])
    const element = createMockElement()

    const positions = fallbackResourceGraphLayout(testGraph, element, "RIGHT")

    const rootPos = positions.get("root-sample")
    const childPos = positions.get("child-sample")

    expect(rootPos).toBeDefined()
    expect(childPos).toBeDefined()
    expect(rootPos?.x).toBe(0)
    expect(rootPos?.y).toBe(0)
    expect(rootPos?.width).toBe(260)
    expect(rootPos?.height).toBe(120)

    expect(childPos?.x).toBe(220 + 80)
    expect(childPos?.y).toBe(0)
    expect(childPos?.width).toBe(220)
    expect(childPos?.height).toBe(100)
  })

  it("computes vertical fallback positions with offset from root", () => {
    const parentNode = createMockNode("parent-sample")
    const rootNode = createMockNode("root-sample")
    const testGraph = createMockGraph("root-sample", [parentNode, rootNode])
    const element = createMockElement()

    const positions = fallbackResourceGraphLayout(testGraph, element, "DOWN")

    const parentPos = positions.get("parent-sample")
    const rootPos = positions.get("root-sample")

    expect(parentPos).toBeDefined()
    expect(rootPos).toBeDefined()
    expect(rootPos?.y).toBe(0)
    expect(parentPos?.y).toBe(-1 * (100 + 80))
  })
})

describe("resource graph association handle routing", () => {
  it("routes horizontally separated nodes through facing left and right perimeter handles", () => {
    expect(
      resolveAssociationHandleIds(
        { height: 88, width: 236, x: 0, y: 0 },
        { height: 88, width: 236, x: 340, y: 20 }
      )
    ).toEqual({
      sourceHandle: "association-source-right",
      targetHandle: "association-target-left",
    })

    expect(
      resolveAssociationHandleIds(
        { height: 88, width: 236, x: 340, y: 20 },
        { height: 88, width: 236, x: 0, y: 0 }
      )
    ).toEqual({
      sourceHandle: "association-source-left",
      targetHandle: "association-target-right",
    })
  })

  it("routes vertically separated nodes through facing top and bottom perimeter handles", () => {
    expect(
      resolveAssociationHandleIds(
        { height: 88, width: 236, x: 0, y: 0 },
        { height: 88, width: 236, x: 20, y: 240 }
      )
    ).toEqual({
      sourceHandle: "association-source-bottom",
      targetHandle: "association-target-top",
    })

    expect(
      resolveAssociationHandleIds(
        { height: 88, width: 236, x: 20, y: 240 },
        { height: 88, width: 236, x: 0, y: 0 }
      )
    ).toEqual({
      sourceHandle: "association-source-top",
      targetHandle: "association-target-bottom",
    })
  })
})

describe("resource graph relationship classification", () => {
  it("classifies direct, multi-hop lineage, and multi-hop associated nodes in order", () => {
    const nodes = [
      createMockNode("grandparent-sample"),
      createMockNode("parent-sample"),
      createMockNode("root-sample"),
      createMockNode("child-sample"),
      createMockNode("grandchild-sample"),
      createMockNode("direct-dataset", "dataset"),
      createMockNode("indirect-dataset", "dataset"),
    ]
    const edges = [
      createMockEdge("e1", "grandparent-sample", "parent-sample", "parent"),
      createMockEdge("e2", "parent-sample", "root-sample", "parent"),
      createMockEdge("e3", "root-sample", "child-sample", "parent"),
      createMockEdge("e4", "child-sample", "grandchild-sample", "parent"),
      createMockEdge("e5", "root-sample", "direct-dataset", "associated"),
      createMockEdge("e6", "child-sample", "indirect-dataset", "associated"),
    ]
    const graph = createMockGraph("root-sample", nodes, edges)

    const presentations = graphRelationshipPresentations(graph)

    expect(presentations.get("root-sample")).toBeUndefined()
    expect(presentations.get("parent-sample")).toEqual({
      distance: 1,
      label: "Parent",
      relationship: "parent",
      typeLabel: null,
    })
    expect(presentations.get("grandparent-sample")).toEqual({
      distance: 2,
      label: "Ancestor",
      relationship: "ancestor",
      typeLabel: "2 hops upstream",
    })
    expect(presentations.get("child-sample")).toEqual({
      distance: 1,
      label: "Child",
      relationship: "child",
      typeLabel: null,
    })
    expect(presentations.get("grandchild-sample")).toEqual({
      distance: 2,
      label: "Descendant",
      relationship: "descendant",
      typeLabel: "2 hops downstream",
    })
    expect(presentations.get("direct-dataset")).toEqual({
      distance: 1,
      label: "Associated",
      relationship: "associated",
      typeLabel: null,
    })
    expect(presentations.get("indirect-dataset")).toEqual({
      distance: 2,
      label: "Associated",
      relationship: "associated",
      typeLabel: "2 hops away",
    })

    const orderedIds = nodes
      .filter((node) => node.unique_id !== "root-sample")
      .map((node) => node.unique_id)
      .sort(
        (left, right) =>
          graphRelationshipOrder(presentations.get(left)) -
          graphRelationshipOrder(presentations.get(right))
      )

    expect(orderedIds).toEqual([
      "parent-sample",
      "grandparent-sample",
      "child-sample",
      "grandchild-sample",
      "direct-dataset",
      "indirect-dataset",
    ])
  })
})

describe("resource graph layout engine resilience", () => {
  it("safely resets layout engine when no instance exists or when already terminated", () => {
    expect(() => resetResourceGraphLayoutEngine()).not.toThrow()
    expect(() => resetResourceGraphLayoutEngine()).not.toThrow()
  })

  it("handles layout execution rejection gracefully on graphs with lineage and associations", async () => {
    const rootNode = createMockNode("root-sample")
    const childNode = createMockNode("child-sample")
    const associatedNode = createMockNode("assoc-sample")
    const lineageEdge = createMockEdge(
      "e1",
      "root-sample",
      "child-sample",
      "parent"
    )
    const assocEdge = createMockEdge(
      "e2",
      "root-sample",
      "assoc-sample",
      "associated"
    )
    const testGraph = createMockGraph(
      "root-sample",
      [rootNode, childNode, associatedNode],
      [lineageEdge, assocEdge]
    )
    const element = createMockElement()

    await expect(
      layoutResourceGraph(testGraph, element, "RIGHT")
    ).rejects.toThrow()
  })
})

describe("resolveGraphNodeClickAction", () => {
  it("opens the inspector immediately on desktop pointer clicks", () => {
    expect(
      resolveGraphNodeClickAction({
        inspectedMfid: null,
        nodeMfid: "sample-1",
        selectedMfid: null,
        twoTapMode: false,
      })
    ).toBe("inspect")
  })

  it("selects an unselected node on the first tap and inspects on the second tap", () => {
    expect(
      resolveGraphNodeClickAction({
        inspectedMfid: null,
        nodeMfid: "sample-1",
        selectedMfid: null,
        twoTapMode: true,
      })
    ).toBe("select")

    expect(
      resolveGraphNodeClickAction({
        inspectedMfid: null,
        nodeMfid: "sample-2",
        selectedMfid: "sample-1",
        twoTapMode: true,
      })
    ).toBe("select")

    expect(
      resolveGraphNodeClickAction({
        inspectedMfid: null,
        nodeMfid: "sample-1",
        selectedMfid: "sample-1",
        twoTapMode: true,
      })
    ).toBe("inspect")

    expect(
      resolveGraphNodeClickAction({
        inspectedMfid: "sample-1",
        nodeMfid: "sample-1",
        selectedMfid: null,
        twoTapMode: true,
      })
    ).toBe("inspect")
  })
})
