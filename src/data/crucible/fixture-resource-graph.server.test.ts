import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { fixtureResourceGraph } from "./fixture-resource-graph.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"

function denseWorkspace() {
  const fixture = readWorkspaceFixture("dense")
  if (fixture.status !== "ready") throw new Error("fixture unavailable")
  return fixture.workspace
}

const ids = (graph: { nodes: readonly { unique_id: string }[] }) =>
  graph.nodes.map((node) => node.unique_id).sort()

describe("fixtureResourceGraph", () => {
  beforeEach(() => vi.stubEnv("NODE_ENV", "development"))
  afterEach(() => vi.unstubAllEnvs())

  it("walks lineage upstream to the requested depth", () => {
    const graph = fixtureResourceGraph(
      "fixture-sample-1",
      { depth: 3, direction: "upstream", relationshipKinds: ["lineage"] },
      denseWorkspace()
    )
    expect(ids(graph)).toEqual(
      [
        "fixture-sample-1",
        "fixture-sample-10",
        "fixture-sample-11",
        "fixture-sample-12",
        "fixture-sample-2",
        "fixture-sample-30",
        "fixture-sample-5",
      ].sort()
    )
    expect(graph.edges.every((edge) => edge.relationship === "parent")).toBe(
      true
    )
    expect(graph.returnedDepth).toBe(3)
  })

  it("marks resources with relationships beyond the returned graph", () => {
    const graph = fixtureResourceGraph(
      "fixture-sample-1",
      { depth: 3, direction: "downstream", relationshipKinds: ["lineage"] },
      denseWorkspace()
    )
    const byId = new Map(graph.nodes.map((node) => [node.unique_id, node]))
    expect(byId.get("fixture-sample-20")?.traversalDepth).toBe(3)
    expect(byId.get("fixture-sample-20")?.expansionAvailability).toEqual({
      ancestors: false,
      associations: true,
      descendants: true,
    })
    expect(byId.has("fixture-sample-21")).toBe(false)
    expect(byId.get("fixture-sample-1")?.expansionAvailability.ancestors).toBe(
      true
    )
  })

  it("returns associations either way and filters lineage types", () => {
    const associations = fixtureResourceGraph(
      "fixture-sample-1",
      { depth: 1, relationshipKinds: ["association"] },
      denseWorkspace()
    )
    expect(ids(associations)).toEqual(
      ["fixture-dataset-1", "fixture-dataset-2", "fixture-sample-1"].sort()
    )

    const derivedOnly = fixtureResourceGraph(
      "fixture-sample-5",
      {
        depth: 1,
        direction: "upstream",
        relationshipKinds: ["lineage"],
        relationshipTypes: ["is_derived_from"],
      },
      denseWorkspace()
    )
    expect(ids(derivedOnly)).toEqual(
      ["fixture-sample-10", "fixture-sample-5"].sort()
    )
  })
})
