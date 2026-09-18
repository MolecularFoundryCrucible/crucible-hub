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
    : new Set(graphExpansionModesByAvailability(node))
  return graphExpansionModes.filter(
    (mode) =>
      (candidates.has(mode) ||
        Boolean(graphExpansionState(states, node.unique_id, mode))) &&
      !graphExpansionState(states, node.unique_id, mode)?.isSuccess
  )
}

export function graphExpansionModesByNode(graph: WorkspaceResourceGraph) {
  return new Map(
    graph.nodes.map(
      (node) =>
        [node.unique_id, graphExpansionModesByAvailability(node)] as const
    )
  )
}

function graphExpansionModesByAvailability(node: WorkspaceResourceGraphNode) {
  return graphExpansionModes.filter((mode) => {
    if (mode === "ancestors") return node.expansionAvailability.ancestors
    if (mode === "descendants") return node.expansionAvailability.descendants
    return node.expansionAvailability.associations
  })
}
