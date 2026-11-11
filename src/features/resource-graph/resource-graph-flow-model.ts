import { Position } from "@xyflow/react"
import type { Edge, Node } from "@xyflow/react"

import type {
  WorkspaceDatasetThumbnail,
  WorkspaceResourceGraph,
  WorkspaceResourceGraphNode,
} from "@/data/crucible/workspace-source"

import {
  graphExpansionModesForNode,
  graphExpansionPending,
  graphExpansionState,
} from "./resource-graph-expansion"
import type {
  GraphExpansionMode,
  GraphExpansionState,
} from "./resource-graph-expansion"
import type { LayoutDirection, LayoutPosition } from "./resource-graph-layout"

export type GraphNodeExpansion = {
  mode: GraphExpansionMode
  status: "error" | "idle" | "pending"
}

export type ResourceFlowNodeData = {
  context: string | null
  dimmed: boolean
  entering: boolean
  expansions: readonly GraphNodeExpansion[]
  highlighted: boolean
  inspected: boolean
  isRoot: boolean
  layoutDirection: LayoutDirection
  node: WorkspaceResourceGraphNode
  onExpand: (nodeMfid: string, mode: GraphExpansionMode) => void
  portalContainer?: React.RefObject<HTMLDivElement | null>
  thumbnail?: WorkspaceDatasetThumbnail
}

export type ResourceFlowNode = Node<ResourceFlowNodeData, "resource">

export type ResourceFlowEdgeData = {
  highlighted: boolean
  relationship: "associated" | "parent"
}

export type ResourceFlowEdge = Edge<ResourceFlowEdgeData>

export type ResourceFlowNodePresentation = {
  activeHighlightMfid: string | null
  activeNeighbours: ReadonlySet<string> | undefined
  displayThumbnails: boolean
  expansionStates: ReadonlyMap<string, GraphExpansionState>
  expansionModesByNode: ReadonlyMap<string, readonly GraphExpansionMode[]>
  inspectedMfid: string | null
  layoutDirection: LayoutDirection
  onExpand: (nodeMfid: string, mode: GraphExpansionMode) => void
  portalContainer?: React.RefObject<HTMLDivElement | null>
  rootContext: string | null
  thumbnails: Readonly<Partial<Record<string, WorkspaceDatasetThumbnail>>>
}

export function reconcileResourceFlowNodes(
  currentNodes: ResourceFlowNode[],
  graph: WorkspaceResourceGraph,
  positions: ReadonlyMap<string, LayoutPosition>,
  presentation: ResourceFlowNodePresentation,
  enteringNodeIds: ReadonlySet<string>
) {
  const currentNodesByMfid = new Map(
    currentNodes.map((node) => [node.id, node] as const)
  )
  return graph.nodes.flatMap<ResourceFlowNode>((node) => {
    const position = positions.get(node.unique_id)
    if (!position) return []
    const currentNode = currentNodesByMfid.get(node.unique_id)
    if (currentNode) {
      const presentedNode = updateResourceFlowNodePresentation(
        currentNode,
        graph.rootMfid,
        node,
        presentation
      )
      return [
        {
          ...presentedNode,
          data: {
            ...presentedNode.data,
            entering: enteringNodeIds.has(node.unique_id),
          },
          position: { x: position.x, y: position.y },
        },
      ]
    }
    return [
      {
        ariaLabel: resourceFlowNodeAriaLabel(node),
        connectable: false,
        data: resourceFlowNodeData(
          graph.rootMfid,
          node,
          presentation,
          enteringNodeIds.has(node.unique_id)
        ),
        deletable: false,
        draggable: true,
        focusable: true,
        id: node.unique_id,
        position: { x: position.x, y: position.y },
        selectable: false,
        sourcePosition:
          presentation.layoutDirection === "DOWN"
            ? Position.Bottom
            : Position.Right,
        targetPosition:
          presentation.layoutDirection === "DOWN"
            ? Position.Top
            : Position.Left,
        type: "resource",
      },
    ]
  })
}

function updateResourceFlowNodePresentation(
  flowNode: ResourceFlowNode,
  rootMfid: string,
  node: WorkspaceResourceGraphNode,
  presentation: ResourceFlowNodePresentation
): ResourceFlowNode {
  const data = resourceFlowNodeData(
    rootMfid,
    node,
    presentation,
    flowNode.data.entering
  )
  const ariaLabel = resourceFlowNodeAriaLabel(node)
  const sourcePosition =
    presentation.layoutDirection === "DOWN" ? Position.Bottom : Position.Right
  const targetPosition =
    presentation.layoutDirection === "DOWN" ? Position.Top : Position.Left
  if (
    sameNodeData(flowNode.data, data) &&
    flowNode.ariaLabel === ariaLabel &&
    flowNode.sourcePosition === sourcePosition &&
    flowNode.targetPosition === targetPosition
  ) {
    return flowNode
  }
  return {
    ...flowNode,
    ariaLabel,
    data: sameNodeData(flowNode.data, data) ? flowNode.data : data,
    focusable: true,
    sourcePosition,
    targetPosition,
  }
}

/** Updates presentation, keeping the array and each unchanged node as they were. */
export function presentResourceFlowNodes(
  current: ResourceFlowNode[],
  graph: WorkspaceResourceGraph,
  presentation: ResourceFlowNodePresentation
) {
  const graphNodes = new Map(
    graph.nodes.map((node) => [node.unique_id, node] as const)
  )
  const next = current.map((flowNode) => {
    const node = graphNodes.get(flowNode.id)
    return node
      ? updateResourceFlowNodePresentation(
          flowNode,
          graph.rootMfid,
          node,
          presentation
        )
      : flowNode
  })
  return next.some((flowNode, index) => flowNode !== current[index])
    ? next
    : current
}

function nodeExpansions(
  node: WorkspaceResourceGraphNode,
  presentation: ResourceFlowNodePresentation
): GraphNodeExpansion[] {
  return graphExpansionModesForNode(
    node,
    presentation.expansionStates,
    presentation.expansionModesByNode.get(node.unique_id)
  ).map((mode) => {
    const state = graphExpansionState(
      presentation.expansionStates,
      node.unique_id,
      mode
    )
    return {
      mode,
      status: graphExpansionPending(state)
        ? "pending"
        : state?.isError
          ? "error"
          : "idle",
    }
  })
}

function sameExpansions(
  left: readonly GraphNodeExpansion[],
  right: readonly GraphNodeExpansion[]
) {
  return (
    left.length === right.length &&
    left.every(
      (item, index) =>
        item.mode === right[index].mode && item.status === right[index].status
    )
  )
}

function sameNodeData(left: ResourceFlowNodeData, right: ResourceFlowNodeData) {
  return (
    left.context === right.context &&
    left.dimmed === right.dimmed &&
    left.entering === right.entering &&
    left.highlighted === right.highlighted &&
    left.inspected === right.inspected &&
    left.isRoot === right.isRoot &&
    left.layoutDirection === right.layoutDirection &&
    left.node === right.node &&
    left.onExpand === right.onExpand &&
    left.portalContainer === right.portalContainer &&
    left.thumbnail === right.thumbnail &&
    sameExpansions(left.expansions, right.expansions)
  )
}

function resourceFlowNodeData(
  rootMfid: string,
  node: WorkspaceResourceGraphNode,
  presentation: ResourceFlowNodePresentation,
  entering: boolean
): ResourceFlowNodeData {
  return {
    context:
      node.unique_id === rootMfid ? presentation.rootContext : node.context,
    dimmed: Boolean(
      presentation.activeNeighbours &&
      !presentation.activeNeighbours.has(node.unique_id)
    ),
    entering,
    expansions: nodeExpansions(node, presentation),
    highlighted: presentation.activeHighlightMfid === node.unique_id,
    inspected: presentation.inspectedMfid === node.unique_id,
    isRoot: node.unique_id === rootMfid,
    layoutDirection: presentation.layoutDirection,
    node,
    onExpand: presentation.onExpand,
    portalContainer: presentation.portalContainer,
    thumbnail:
      presentation.displayThumbnails && node.kind === "dataset"
        ? presentation.thumbnails[node.unique_id]
        : undefined,
  }
}

function resourceFlowNodeAriaLabel(node: WorkspaceResourceGraphNode) {
  return `${node.kind === "sample" ? "Sample" : "Dataset"}: ${node.name}`
}

export function updateResourceFlowNodePositions(
  nodes: ResourceFlowNode[],
  positions: ReadonlyMap<string, LayoutPosition>
) {
  let changed = false
  const nextNodes: ResourceFlowNode[] = []
  for (const node of nodes) {
    const position = positions.get(node.id)
    if (!position) {
      changed = true
      continue
    }
    if (node.position.x === position.x && node.position.y === position.y) {
      nextNodes.push(node)
      continue
    }
    changed = true
    nextNodes.push({
      ...node,
      position: { x: position.x, y: position.y },
    })
  }
  return changed ? nextNodes : nodes
}

export function clearEnteringFlowNodes(nodes: ResourceFlowNode[]) {
  let changed = false
  const nextNodes: ResourceFlowNode[] = []
  for (const node of nodes) {
    if (!node.data.entering) {
      nextNodes.push(node)
      continue
    }
    changed = true
    nextNodes.push({ ...node, data: { ...node.data, entering: false } })
  }
  return changed ? nextNodes : nodes
}
