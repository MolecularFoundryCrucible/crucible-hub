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
} from "./resource-graph-canvas"

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
