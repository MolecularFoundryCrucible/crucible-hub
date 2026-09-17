import type {
  WorkspaceResourceGraph,
  WorkspaceResourceGraphNode,
} from "@/data/crucible/workspace-source"

export type ResourceGraphLayoutMetrics = {
  associationColumnGap: number
  associationGap: number
  associationRowGap: number
  columnGap: number
  nodeGap: number
  nodeHeight: number
  nodeWidth: number
  rowGap: number
  rootNodeHeight: number
  rootNodeWidth: number
}

export type ResourceGraphNodeGroup =
  | "associated-dataset"
  | "associated-sample"
  | "child"
  | "parent"
  | "related"
  | "root"

export type ResourceGraphLayout = {
  groups: Record<ResourceGraphNodeGroup, readonly WorkspaceResourceGraphNode[]>
  positions: Readonly<Record<string, { x: number; y: number }>>
}

const associationColumns = 4

export function buildResourceGraphLayout(
  graph: WorkspaceResourceGraph,
  metrics: ResourceGraphLayoutMetrics
): ResourceGraphLayout {
  const groups = groupResourceGraphNodes(graph)
  const spacing = collisionSafeSpacing(metrics)
  const positions: Record<string, { x: number; y: number }> = {
    [graph.rootMfid]: { x: 0, y: 0 },
  }

  placeVertical(groups.parent, -spacing.columnGap, spacing.rowGap, positions)
  placeVertical(groups.child, spacing.columnGap, spacing.rowGap, positions)
  const lineageHalfHeight = Math.max(
    metrics.rootNodeHeight / 2,
    verticalHalfExtent(
      groups.parent.length,
      spacing.rowGap,
      metrics.nodeHeight
    ),
    verticalHalfExtent(groups.child.length, spacing.rowGap, metrics.nodeHeight)
  )
  const associationGap = Math.max(
    metrics.associationGap,
    lineageHalfHeight + metrics.nodeHeight / 2 + metrics.nodeGap
  )
  placeAssociationGrid(
    groups["associated-sample"],
    -1,
    spacing,
    associationGap,
    positions,
    0
  )
  placeAssociationGrid(
    groups["associated-dataset"],
    1,
    spacing,
    associationGap,
    positions,
    0
  )
  placeAssociationGrid(
    groups.related,
    1,
    spacing,
    associationGap,
    positions,
    Math.ceil(groups["associated-dataset"].length / associationColumns)
  )

  return { groups, positions }
}

function groupResourceGraphNodes(graph: WorkspaceResourceGraph) {
  const groups: Record<ResourceGraphNodeGroup, WorkspaceResourceGraphNode[]> = {
    "associated-dataset": [],
    "associated-sample": [],
    child: [],
    parent: [],
    related: [],
    root: [],
  }

  for (const node of graph.nodes) {
    const group = resourceGraphNodeGroup(graph, node)
    groups[group].push(node)
  }

  for (const nodes of Object.values(groups)) {
    nodes.sort(
      (left, right) =>
        left.name.localeCompare(right.name) ||
        left.unique_id.localeCompare(right.unique_id)
    )
  }

  return groups
}

function resourceGraphNodeGroup(
  graph: WorkspaceResourceGraph,
  node: WorkspaceResourceGraphNode
): ResourceGraphNodeGroup {
  if (node.unique_id === graph.rootMfid) return "root"
  const edge = graph.edges.find(
    (candidate) =>
      (candidate.source === node.unique_id &&
        candidate.target === graph.rootMfid) ||
      (candidate.source === graph.rootMfid &&
        candidate.target === node.unique_id)
  )
  if (!edge) return "related"
  if (edge.relationship === "associated") {
    return node.kind === "sample" ? "associated-sample" : "associated-dataset"
  }
  if (edge.source === node.unique_id && edge.target === graph.rootMfid) {
    return "parent"
  }
  if (edge.source === graph.rootMfid && edge.target === node.unique_id) {
    return "child"
  }
  return "related"
}

function placeVertical(
  nodes: readonly WorkspaceResourceGraphNode[],
  x: number,
  gap: number,
  positions: Record<string, { x: number; y: number }>
) {
  nodes.forEach((node, index) => {
    positions[node.unique_id] = {
      x,
      y: centeredOffset(index, nodes.length, gap),
    }
  })
}

function placeAssociationGrid(
  nodes: readonly WorkspaceResourceGraphNode[],
  direction: -1 | 1,
  metrics: Pick<
    ResourceGraphLayoutMetrics,
    "associationColumnGap" | "associationRowGap"
  >,
  associationGap: number,
  positions: Record<string, { x: number; y: number }>,
  rowOffset: number
) {
  nodes.forEach((node, index) => {
    const localRow = Math.floor(index / associationColumns)
    const row = rowOffset + localRow
    const rowStart = localRow * associationColumns
    const rowLength = Math.min(associationColumns, nodes.length - rowStart)
    const column = index - rowStart
    positions[node.unique_id] = {
      x: centeredOffset(column, rowLength, metrics.associationColumnGap),
      y: direction * (associationGap + row * metrics.associationRowGap),
    }
  })
}

function collisionSafeSpacing(metrics: ResourceGraphLayoutMetrics) {
  return {
    associationColumnGap: Math.max(
      metrics.associationColumnGap,
      metrics.nodeWidth + metrics.nodeGap
    ),
    associationRowGap: Math.max(
      metrics.associationRowGap,
      metrics.nodeHeight + metrics.nodeGap
    ),
    columnGap: Math.max(
      metrics.columnGap,
      metrics.rootNodeWidth / 2 + metrics.nodeWidth / 2 + metrics.nodeGap
    ),
    rowGap: Math.max(metrics.rowGap, metrics.nodeHeight + metrics.nodeGap),
  }
}

function verticalHalfExtent(count: number, rowGap: number, nodeHeight: number) {
  if (count === 0) return 0
  return ((count - 1) / 2) * rowGap + nodeHeight / 2
}

function centeredOffset(index: number, count: number, gap: number) {
  return (index - (count - 1) / 2) * gap
}
