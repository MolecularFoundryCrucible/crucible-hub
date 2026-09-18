import type {
  WorkspaceResourceGraph,
  WorkspaceResourceGraphNode,
  WorkspaceResourceGraphRequest,
} from "@/data/crucible/workspace-source"

export type GraphExpansionMode = "ancestors" | "associations" | "descendants"

export type ResourceGraphDepth = 1 | 2 | 3

export type GraphExpansionRequest = {
  mode: GraphExpansionMode
  nodeMfid: string
}

export type GraphExpansionState = {
  isError: boolean
  isFetching: boolean
  isPending: boolean
  isSuccess: boolean
  refetch: () => Promise<unknown>
}

export const graphExpansionModes: readonly GraphExpansionMode[] = [
  "ancestors",
  "descendants",
  "associations",
]

export function graphExpansionKey(nodeMfid: string, mode: GraphExpansionMode) {
  return `${nodeMfid}:${mode}`
}

export function graphExpansionQuery(
  mode: GraphExpansionMode
): WorkspaceResourceGraphRequest {
  if (mode === "ancestors") {
    return {
      depth: 1,
      direction: "upstream",
      relationshipKinds: ["lineage"],
    }
  }
  if (mode === "descendants") {
    return {
      depth: 1,
      direction: "downstream",
      relationshipKinds: ["lineage"],
    }
  }
  return {
    depth: 1,
    direction: "both",
    relationshipKinds: ["association"],
  }
}

export function graphExpansionModeLabel(mode: GraphExpansionMode) {
  if (mode === "ancestors") return "Ancestors"
  if (mode === "descendants") return "Descendants"
  return "Associated"
}

export function graphExpansionState(
  states: ReadonlyMap<string, GraphExpansionState>,
  nodeMfid: string,
  mode: GraphExpansionMode
) {
  return states.get(graphExpansionKey(nodeMfid, mode))
}

export function graphExpansionPending(state?: GraphExpansionState) {
  return Boolean(state?.isPending || state?.isFetching)
}

export function graphNodeCanExpand(
  node: WorkspaceResourceGraphNode,
  states: ReadonlyMap<string, GraphExpansionState>,
  availableModes?: readonly GraphExpansionMode[]
) {
  return graphExpansionModesForNode(node, states, availableModes).length > 0
}

export function graphExpansionModesForNode(
  node: WorkspaceResourceGraphNode,
  states: ReadonlyMap<string, GraphExpansionState>,
  availableModes?: readonly GraphExpansionMode[]
) {
  const candidates = availableModes
    ? new Set(availableModes)
    : node.hasMoreRelationships === false
      ? new Set<GraphExpansionMode>()
      : new Set(graphExpansionModes)
  return graphExpansionModes.filter(
    (mode) =>
      (candidates.has(mode) ||
        Boolean(graphExpansionState(states, node.unique_id, mode))) &&
      !graphExpansionState(states, node.unique_id, mode)?.isSuccess
  )
}

export function graphExpansionModesByNode(graph: WorkspaceResourceGraph) {
  const ancestors = graphDirectionalReachability(graph, "ancestors")
  const descendants = graphDirectionalReachability(graph, "descendants")
  const associated = new Set(
    graph.edges
      .filter((edge) => edge.relationship === "associated")
      .flatMap((edge) => [edge.source, edge.target])
  )
  return new Map(
    graph.nodes.map((node) => {
      const modes = new Set<GraphExpansionMode>()
      if (ancestors.has(node.unique_id)) {
        modes.add("descendants")
        modes.add("associations")
        if (node.hasMoreRelationships !== false) modes.add("ancestors")
      }
      if (descendants.has(node.unique_id)) {
        modes.add("ancestors")
        modes.add("associations")
        if (node.hasMoreRelationships !== false) modes.add("descendants")
      }
      if (
        node.unique_id !== graph.rootMfid &&
        associated.has(node.unique_id) &&
        !ancestors.has(node.unique_id) &&
        !descendants.has(node.unique_id)
      ) {
        modes.add("ancestors")
        modes.add("descendants")
        if (node.hasMoreRelationships !== false) modes.add("associations")
      }
      if (
        node.unique_id === graph.rootMfid &&
        node.hasMoreRelationships !== false
      ) {
        graphExpansionModes.forEach((mode) => modes.add(mode))
      }
      return [
        node.unique_id,
        graphExpansionModes.filter((mode) => modes.has(mode)),
      ] as const
    })
  )
}

function graphDirectionalReachability(
  graph: WorkspaceResourceGraph,
  direction: "ancestors" | "descendants"
) {
  const reached = new Set<string>()
  const pending = [graph.rootMfid]
  while (pending.length > 0) {
    const current = pending.shift()
    if (!current) continue
    for (const edge of graph.edges) {
      if (edge.relationship !== "parent") continue
      const next =
        direction === "ancestors" && edge.target === current
          ? edge.source
          : direction === "descendants" && edge.source === current
            ? edge.target
            : undefined
      if (!next || reached.has(next) || next === graph.rootMfid) continue
      reached.add(next)
      pending.push(next)
    }
  }
  return reached
}
