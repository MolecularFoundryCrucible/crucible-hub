import type {
  WorkspaceResourceGraph,
  WorkspaceResourceGraphNode,
} from "@/data/crucible/workspace-source"

export function mergeResourceGraphs(
  rootGraph: WorkspaceResourceGraph,
  expansionGraphs: readonly WorkspaceResourceGraph[]
): WorkspaceResourceGraph {
  const graphs = [rootGraph, ...expansionGraphs]
  const nodes = new Map<string, WorkspaceResourceGraphNode>()
  const edges = new Map(
    graphs.flatMap((graph) =>
      graph.edges.map((edge) => [edge.id, edge] as const)
    )
  )

  for (const graph of graphs) {
    for (const node of graph.nodes) nodes.set(node.unique_id, node)
  }
  for (const graph of graphs) {
    const expandedRoot = graph.nodes.find(
      (node) => node.unique_id === graph.rootMfid
    )
    if (expandedRoot) nodes.set(graph.rootMfid, expandedRoot)
  }

  const traversalDepths = graphTraversalDepths(rootGraph.rootMfid, [
    ...edges.values(),
  ])
  const mergedNodes = [...nodes.values()]
    .filter((node) => traversalDepths.has(node.unique_id))
    .map((node) => ({
      ...node,
      traversalDepth: traversalDepths.get(node.unique_id) ?? 0,
    }))
  const mergedEdges = [...edges.values()].filter(
    (edge) =>
      traversalDepths.has(edge.source) && traversalDepths.has(edge.target)
  )
  const truncationReasons = [
    ...new Set(graphs.flatMap((graph) => graph.truncationReasons)),
  ]

  return {
    edgeLimit: Math.min(...graphs.map((graph) => graph.edgeLimit)),
    edges: mergedEdges,
    hasMore: mergedNodes.some((node) => node.hasMoreRelationships !== false),
    nodeLimit: Math.min(...graphs.map((graph) => graph.nodeLimit)),
    nodes: mergedNodes,
    requestedDepth: rootGraph.requestedDepth,
    returnedDepth: Math.max(...traversalDepths.values(), 0),
    rootMfid: rootGraph.rootMfid,
    truncated: graphs.some((graph) => graph.truncated),
    truncationReasons,
  }
}

function graphTraversalDepths(
  rootMfid: string,
  edges: WorkspaceResourceGraph["edges"]
) {
  const neighbours = new Map<string, Set<string>>()
  for (const edge of edges) {
    addNeighbour(neighbours, edge.source, edge.target)
    addNeighbour(neighbours, edge.target, edge.source)
  }

  const depths = new Map([[rootMfid, 0]])
  const pending = [rootMfid]
  while (pending.length > 0) {
    const current = pending.shift()
    if (!current) continue
    const nextDepth = (depths.get(current) ?? 0) + 1
    for (const neighbour of neighbours.get(current) ?? []) {
      if (depths.has(neighbour)) continue
      depths.set(neighbour, nextDepth)
      pending.push(neighbour)
    }
  }
  return depths
}

function addNeighbour(
  neighbours: Map<string, Set<string>>,
  source: string,
  target: string
) {
  const values = neighbours.get(source) ?? new Set<string>()
  values.add(target)
  neighbours.set(source, values)
}
