import ELK from "elkjs/lib/elk-api.js"
import ELKWorker from "elkjs/lib/elk-worker.min.js?worker"
import type { ELK as ELKInstance } from "elkjs/lib/elk-api.js"
import type { ReactFlowInstance } from "@xyflow/react"

import type { WorkspaceResourceGraph } from "@/data/crucible/workspace-source"
import { motionDuration } from "@/lib/motion"

import type {
  ResourceFlowEdge,
  ResourceFlowNode,
} from "./resource-graph-flow-model"
import type { GraphOrientation } from "./resource-graph-display"

export type LayoutDirection = "DOWN" | "RIGHT"

export type LayoutPosition = {
  height: number
  width: number
  x: number
  y: number
}

const ELK_LAYOUT_TIMEOUT_MS = 6000

let elk: ELKInstance | undefined

/** Drops the engine, or only `failed` when given, so a newer engine survives. */
export function resetResourceGraphLayoutEngine(failed?: ELKInstance) {
  if (!elk || (failed && failed !== elk)) return
  try {
    elk.terminateWorker()
  } catch {
    // Worker could already be terminated.
  }
  elk = undefined
}

function resourceGraphLayoutEngine() {
  elk ??= new ELK({ workerFactory: () => new ELKWorker() })
  return elk
}

export function warmResourceGraphLayoutEngine() {
  void resourceGraphLayoutEngine()
    .layout({
      id: "warmup",
      layoutOptions: { "elk.algorithm": "layered" },
      children: [
        { id: "a", width: 1, height: 1 },
        { id: "b", width: 1, height: 1 },
      ],
      edges: [{ id: "e", sources: ["a"], targets: ["b"] }],
    })
    .catch(() => undefined)
}

export function resolveAssociationHandleIds(
  sourcePosition: LayoutPosition,
  targetPosition: LayoutPosition
): {
  sourceHandle:
    | "association-source-bottom"
    | "association-source-left"
    | "association-source-right"
    | "association-source-top"
  targetHandle:
    | "association-target-bottom"
    | "association-target-left"
    | "association-target-right"
    | "association-target-top"
} {
  const sourceCenterX = sourcePosition.x + sourcePosition.width / 2
  const sourceCenterY = sourcePosition.y + sourcePosition.height / 2
  const targetCenterX = targetPosition.x + targetPosition.width / 2
  const targetCenterY = targetPosition.y + targetPosition.height / 2
  const dx = targetCenterX - sourceCenterX
  const dy = targetCenterY - sourceCenterY
  const avgWidth = Math.max(
    (sourcePosition.width + targetPosition.width) / 2,
    1
  )
  const avgHeight = Math.max(
    (sourcePosition.height + targetPosition.height) / 2,
    1
  )
  if (Math.abs(dx) / avgWidth >= Math.abs(dy) / avgHeight) {
    return dx >= 0
      ? {
          sourceHandle: "association-source-right",
          targetHandle: "association-target-left",
        }
      : {
          sourceHandle: "association-source-left",
          targetHandle: "association-target-right",
        }
  }
  return dy >= 0
    ? {
        sourceHandle: "association-source-bottom",
        targetHandle: "association-target-top",
      }
    : {
        sourceHandle: "association-source-top",
        targetHandle: "association-target-bottom",
      }
}

export async function layoutResourceGraph(
  graph: WorkspaceResourceGraph,
  element: HTMLElement,
  direction: LayoutDirection,
  previousPositions?: ReadonlyMap<string, LayoutPosition> | null
): Promise<Map<string, LayoutPosition>> {
  const nodeWidth = graphNumberToken(element, "--graph-node-width")
  const nodeHeight = graphNumberToken(element, "--graph-node-height")
  const rootWidth = graphNumberToken(element, "--graph-root-node-width")
  const rootHeight = graphNumberToken(element, "--graph-root-node-height")
  const layerGap = graphNumberToken(element, "--graph-layout-layer-gap")
  const nodeGap = graphNumberToken(element, "--graph-layout-node-gap")

  const nodeIds = new Set(graph.nodes.map((node) => node.unique_id))
  const validEdges = graph.edges.filter(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)
  )

  const engine = resourceGraphLayoutEngine()
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    const layoutPromise = engine.layout({
      children: graph.nodes.map((node) => {
        const isRoot = node.unique_id === graph.rootMfid
        const width = isRoot ? rootWidth : nodeWidth
        const height = isRoot ? rootHeight : nodeHeight
        const prev = previousPositions?.get(node.unique_id)
        return {
          height,
          id: node.unique_id,
          width,
          ...(prev
            ? {
                layoutOptions: {
                  "elk.position": `(${prev.x}, ${prev.y})`,
                },
                x: prev.x,
                y: prev.y,
              }
            : {}),
        }
      }),
      edges: validEdges.map((edge) => {
        const isAssociated = edge.relationship === "associated"
        return {
          id: edge.id,
          sources: [edge.source],
          targets: [edge.target],
          layoutOptions: {
            "org.eclipse.elk.edge.type": isAssociated
              ? "ASSOCIATION"
              : "DIRECTED",
            "org.eclipse.elk.layered.priority.direction": isAssociated
              ? "0"
              : "10",
          },
        }
      }),
      id: "resource-graph",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": direction,
        "elk.edgeRouting": "ORTHOGONAL",
        "elk.layered.cycleBreaking.strategy": "GREEDY",
        "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
        "elk.layered.crossingMinimization.semiInteractive":
          previousPositions && previousPositions.size > 0 ? "true" : "false",
        "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
        "elk.layered.nodePlacement.favorStraightEdges": "true",
        "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
        "elk.layered.spacing.nodeNodeBetweenLayers": String(layerGap),
        "elk.spacing.nodeNode": String(nodeGap),
      },
    })

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error("Resource graph layout calculation timed out"))
      }, ELK_LAYOUT_TIMEOUT_MS)
    })

    const layout = await Promise.race([layoutPromise, timeoutPromise])

    return new Map(
      (layout.children ?? []).map((node) => [
        node.id,
        {
          height: node.height,
          width: node.width,
          x: node.x ?? 0,
          y: node.y ?? 0,
        },
      ])
    )
  } catch (error) {
    resetResourceGraphLayoutEngine(engine)
    throw error
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

/**
 * Layers by lineage distance from the current resource (ancestors before,
 * descendants after, associated resources level with their neighbour), used
 * when ELK fails or times out.
 */
export function fallbackResourceGraphLayout(
  graph: WorkspaceResourceGraph,
  element: HTMLElement,
  direction: LayoutDirection
) {
  const nodeWidth = graphNumberToken(element, "--graph-node-width")
  const nodeHeight = graphNumberToken(element, "--graph-node-height")
  const rootWidth = graphNumberToken(element, "--graph-root-node-width")
  const rootHeight = graphNumberToken(element, "--graph-root-node-height")
  const layerGap = graphNumberToken(element, "--graph-layout-layer-gap")
  const nodeGap = graphNumberToken(element, "--graph-layout-node-gap")
  const horizontal = direction === "RIGHT"
  const layerStep = (horizontal ? nodeWidth : nodeHeight) + layerGap
  const crossStep = (horizontal ? nodeHeight : nodeWidth) + nodeGap

  const neighbours = new Map<string, { id: string; offset: number }[]>()
  const link = (from: string, id: string, offset: number) => {
    const list = neighbours.get(from)
    if (list) list.push({ id, offset })
    else neighbours.set(from, [{ id, offset }])
  }
  for (const edge of graph.edges) {
    const offset = edge.relationship === "parent" ? 1 : 0
    link(edge.source, edge.target, offset)
    link(edge.target, edge.source, -offset)
  }

  const layers = new Map([[graph.rootMfid, 0]])
  const queue = [graph.rootMfid]
  for (const from of queue) {
    const layer = layers.get(from) ?? 0
    for (const next of neighbours.get(from) ?? []) {
      if (layers.has(next.id)) continue
      layers.set(next.id, layer + next.offset)
      queue.push(next.id)
    }
  }

  const members = new Map<number, string[]>()
  for (const node of graph.nodes) {
    if (node.unique_id === graph.rootMfid) continue
    const layer = layers.get(node.unique_id) ?? 0
    const list = members.get(layer)
    if (list) list.push(node.unique_id)
    else members.set(layer, [node.unique_id])
  }

  const cross = new Map<string, number>([[graph.rootMfid, 0]])
  for (const [layer, ids] of members) {
    ids.forEach((id, index) => {
      cross.set(
        id,
        layer === 0
          ? (index % 2 === 0 ? 1 : -1) * Math.ceil((index + 1) / 2) * crossStep
          : (index - (ids.length - 1) / 2) * crossStep
      )
    })
  }

  return new Map(
    graph.nodes.map((node) => {
      const isRoot = node.unique_id === graph.rootMfid
      const main = (layers.get(node.unique_id) ?? 0) * layerStep
      const offset = cross.get(node.unique_id) ?? 0
      return [
        node.unique_id,
        {
          height: isRoot ? rootHeight : nodeHeight,
          width: isRoot ? rootWidth : nodeWidth,
          x: horizontal ? main : offset,
          y: horizontal ? offset : main,
        },
      ]
    })
  )
}

export function centerResourceGraph(
  flow: ReactFlowInstance<ResourceFlowNode, ResourceFlowEdge>,
  element: HTMLElement,
  rootMfid: string,
  positions: ReadonlyMap<string, LayoutPosition>,
  animate: boolean
) {
  const root = positions.get(rootMfid)
  if (!root) return
  const rootCenter = {
    x: root.x + root.width / 2,
    y: root.y + root.height / 2,
  }
  const allPositions = [...positions.values()]
  const minX = Math.min(...allPositions.map((position) => position.x))
  const maxX = Math.max(
    ...allPositions.map((position) => position.x + position.width)
  )
  const minY = Math.min(...allPositions.map((position) => position.y))
  const maxY = Math.max(
    ...allPositions.map((position) => position.y + position.height)
  )
  const boundsWidth = Math.max(maxX - minX, 1)
  const boundsHeight = Math.max(maxY - minY, 1)
  const padding = graphNumberToken(element, "--graph-fit-padding")
  const availableWidth = Math.max(element.clientWidth - padding * 2, 1)
  const availableHeight = Math.max(element.clientHeight - padding * 2, 1)
  const finalZoom = Math.max(
    Math.min(
      availableWidth / boundsWidth,
      availableHeight / boundsHeight,
      1,
      graphNumberToken(element, "--graph-max-zoom")
    ),
    graphNumberToken(element, "--graph-readable-zoom"),
    graphNumberToken(element, "--graph-min-zoom")
  )
  const centerX =
    boundsWidth * finalZoom <= availableWidth ? (minX + maxX) / 2 : rootCenter.x
  const centerY =
    boundsHeight * finalZoom <= availableHeight
      ? (minY + maxY) / 2
      : rootCenter.y
  void flow.setCenter(centerX, centerY, {
    ...(animate ? graphViewportOptions(element) : { duration: 0 }),
    zoom: finalZoom,
  })
}

export function alignLayoutToAnchor(
  positions: ReadonlyMap<string, LayoutPosition>,
  previousPositions: ReadonlyMap<string, LayoutPosition>,
  anchorMfid: string
) {
  const anchor = positions.get(anchorMfid)
  const previousAnchor = previousPositions.get(anchorMfid)
  if (!anchor || !previousAnchor) return new Map(positions)
  const offsetX =
    previousAnchor.x + previousAnchor.width / 2 - (anchor.x + anchor.width / 2)
  const offsetY =
    previousAnchor.y +
    previousAnchor.height / 2 -
    (anchor.y + anchor.height / 2)
  return new Map(
    [...positions].map(([nodeMfid, position]) => [
      nodeMfid,
      {
        ...position,
        x: position.x + offsetX,
        y: position.y + offsetY,
      },
    ])
  )
}

export function layoutAnimationStartPositions(
  previousPositions: ReadonlyMap<string, LayoutPosition>,
  nextPositions: ReadonlyMap<string, LayoutPosition>,
  anchorMfid: string
) {
  const anchor =
    previousPositions.get(anchorMfid) ?? previousPositions.values().next().value
  const origin = anchor
    ? {
        x: anchor.x + anchor.width / 2,
        y: anchor.y + anchor.height / 2,
      }
    : null
  return new Map(
    [...nextPositions].map(([nodeMfid, next]) => {
      const previous = previousPositions.get(nodeMfid)
      return [
        nodeMfid,
        {
          ...next,
          x: previous?.x ?? (origin ? origin.x - next.width / 2 : next.x),
          y: previous?.y ?? (origin ? origin.y - next.height / 2 : next.y),
        },
      ]
    })
  )
}

export function interpolateLayoutPositions(
  startPositions: ReadonlyMap<string, LayoutPosition>,
  nextPositions: ReadonlyMap<string, LayoutPosition>,
  progress: number
) {
  return new Map(
    [...nextPositions].map(([nodeMfid, next]) => {
      const start = startPositions.get(nodeMfid) ?? next
      return [
        nodeMfid,
        {
          ...next,
          x: start.x + (next.x - start.x) * progress,
          y: start.y + (next.y - start.y) * progress,
        },
      ]
    })
  )
}

export function fitAllViewportOptions(element: HTMLElement | null) {
  return { ...graphViewportOptions(element), maxZoom: 1, padding: 0.16 }
}

export function graphViewportOptions(element: HTMLElement | null) {
  return { duration: element ? motionDuration("--motion-deliberate") : 0 }
}

export function graphNumberToken(
  element: HTMLElement | null,
  name: string,
  fallback?: number
) {
  if (!element) {
    if (fallback !== undefined) return fallback
    throw new Error(`Missing graph token host: ${name}`)
  }
  const value = Number(getComputedStyle(element).getPropertyValue(name))
  if (!Number.isFinite(value)) throw new Error(`Invalid graph token: ${name}`)
  return value
}

export function resolveLayoutDirection(
  orientation: GraphOrientation
): LayoutDirection {
  if (orientation === "horizontal") return "RIGHT"
  return "DOWN"
}

export function graphDensity(nodeCount: number) {
  if (nodeCount <= 3) return "sparse"
  if (nodeCount >= 12) return "dense"
  return "standard"
}

export function resourceGraphLayoutSignature(graph: WorkspaceResourceGraph) {
  return [
    graph.rootMfid,
    ...graph.nodes.map((node) => node.unique_id),
    ...graph.edges.map(
      (edge) => `${edge.id}:${edge.source}:${edge.target}:${edge.relationship}`
    ),
  ].join("|")
}
