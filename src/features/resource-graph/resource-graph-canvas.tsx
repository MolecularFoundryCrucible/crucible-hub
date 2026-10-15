import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import ELK from "elkjs/lib/elk-api.js"
import ELKWorker from "elkjs/lib/elk-worker.min.js?worker"
import type { ELK as ELKInstance } from "elkjs/lib/elk-api.js"
import {
  Background,
  BackgroundVariant,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
} from "@xyflow/react"
import type {
  Edge,
  Node,
  NodeMouseHandler,
  NodeProps,
  OnNodeDrag,
  ReactFlowInstance,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import {
  ExploreGraphFocusIcon,
  EnterGraphFullscreenIcon,
  ExitGraphFullscreenIcon,
  FitGraphIcon,
  GraphAncestorsIcon,
  GraphAncestorsVerticalIcon,
  GraphAssociationsIcon,
  GraphDescendantsIcon,
  GraphDescendantsVerticalIcon,
  GraphDisplayOptionsIcon,
  ResetGraphLayoutIcon,
  ZoomInGraphIcon,
  ZoomOutGraphIcon,
} from "@/components/crucible/icons"
import { BreakableText } from "@/components/crucible/breakable-text"
import { DatasetThumbnailImage } from "@/components/crucible/dataset-thumbnail"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type {
  WorkspaceDatasetThumbnail,
  WorkspaceResourceGraph,
  WorkspaceResourceGraphNode,
} from "@/data/crucible/workspace-source"
import { cn } from "@/lib/utils"
import {
  graphExpansionModeLabel,
  graphExpansionModesForNode,
  graphExpansionPending,
  graphExpansionState,
} from "./resource-graph-expansion"
import type {
  GraphOrientation,
  ResourceGraphDisplay,
} from "./resource-graph-display"
import type {
  GraphExpansionMode,
  GraphExpansionState,
} from "./resource-graph-expansion"
import { PendingIcon } from "@/components/crucible/pending-icon"

type ResourceFlowNodeData = {
  context: string | null
  dimmed: boolean
  entering: boolean
  expansionStates: ReadonlyMap<string, GraphExpansionState>
  expansionModes: readonly GraphExpansionMode[]
  highlighted: boolean
  inspected: boolean
  isRoot: boolean
  layoutDirection: LayoutDirection
  node: WorkspaceResourceGraphNode
  onExpand: (nodeMfid: string, mode: GraphExpansionMode) => void
  portalContainer?: React.RefObject<HTMLDivElement | null>
  thumbnail?: WorkspaceDatasetThumbnail
}

type ResourceFlowNode = Node<ResourceFlowNodeData, "resource">

type ResourceFlowEdgeData = {
  highlighted: boolean
  relationship: "associated" | "parent"
}

type ResourceFlowEdge = Edge<ResourceFlowEdgeData>

export type LayoutDirection = "DOWN" | "RIGHT"

export type LayoutPosition = {
  height: number
  width: number
  x: number
  y: number
}

type EdgeMetrics = {
  cornerRadius: number
  markerSize: number
}

type ExpansionAnchor = {
  layoutSignature: string
  mode: GraphExpansionMode
  nodeMfid: string
  requestStarted: boolean
  retry: boolean
}

type ResourceFlowNodePresentation = {
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

const GRAPH_VIEWPORT_CULLING_NODE_THRESHOLD = 100
const ELK_LAYOUT_TIMEOUT_MS = 6000
const reactFlowProOptions = { hideAttribution: true }
let elk: ELKInstance | undefined

export function resetResourceGraphLayoutEngine() {
  if (elk) {
    try {
      elk.terminateWorker()
    } catch {
      // Worker could already be terminated.
    }
    elk = undefined
  }
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

export const ResourceGraphCanvas = memo(function ResourceGraphCanvasComponent({
  display,
  expansionStates,
  expansionModesByNode,
  focusRequest = null,
  graph,
  highlightedMfid = null,
  inspectedMfid = null,
  loading,
  onExpand,
  onDisplayChange,
  onInspect,
  rootContext,
  thumbnails,
}: {
  display: ResourceGraphDisplay
  expansionStates: ReadonlyMap<string, GraphExpansionState>
  expansionModesByNode: ReadonlyMap<string, readonly GraphExpansionMode[]>
  focusRequest?: { mfid: string; nonce: number } | null
  graph: WorkspaceResourceGraph
  highlightedMfid?: string | null
  inspectedMfid?: string | null
  loading: boolean
  onExpand: (nodeMfid: string, mode: GraphExpansionMode) => void
  onDisplayChange: (changes: Partial<ResourceGraphDisplay>) => void
  onInspect: (mfid: string, trigger: HTMLElement) => void
  rootContext: string | null
  thumbnails: Readonly<Partial<Record<string, WorkspaceDatasetThumbnail>>>
}) {
  return (
    <ReactFlowProvider>
      <ResourceGraphFlow
        display={display}
        expansionStates={expansionStates}
        expansionModesByNode={expansionModesByNode}
        focusRequest={focusRequest}
        graph={graph}
        highlightedMfid={highlightedMfid}
        inspectedMfid={inspectedMfid}
        loading={loading}
        onExpand={onExpand}
        onDisplayChange={onDisplayChange}
        onInspect={onInspect}
        rootContext={rootContext}
        thumbnails={thumbnails}
      />
    </ReactFlowProvider>
  )
})

function ResourceGraphFlow({
  display,
  expansionStates,
  expansionModesByNode,
  focusRequest,
  graph,
  highlightedMfid,
  inspectedMfid,
  loading,
  onExpand,
  onDisplayChange,
  onInspect,
  rootContext,
  thumbnails,
}: {
  display: ResourceGraphDisplay
  expansionStates: ReadonlyMap<string, GraphExpansionState>
  expansionModesByNode: ReadonlyMap<string, readonly GraphExpansionMode[]>
  focusRequest: { mfid: string; nonce: number } | null
  graph: WorkspaceResourceGraph
  highlightedMfid: string | null
  inspectedMfid: string | null
  loading: boolean
  onExpand: (nodeMfid: string, mode: GraphExpansionMode) => void
  onDisplayChange: (changes: Partial<ResourceGraphDisplay>) => void
  onInspect: (mfid: string, trigger: HTMLElement) => void
  rootContext: string | null
  thumbnails: Readonly<Partial<Record<string, WorkspaceDatasetThumbnail>>>
}) {
  const surface = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()
  const displayedPositions = useRef(new Map<string, LayoutPosition>())
  const visibleEdgeIds = useRef(new Set<string>())
  const pendingExpansionAnchor = useRef<ExpansionAnchor | null>(null)
  const lastHandledFocusNonce = useRef<number | null>(null)
  const layoutAnimationFrame = useRef<number | null>(null)
  const entryRevealFrame = useRef<number | null>(null)
  const layoutSignature = useMemo(
    () => resourceGraphLayoutSignature(graph),
    [graph]
  )
  const layoutGraph = useRef({ graph, signature: layoutSignature })
  if (layoutGraph.current.signature !== layoutSignature) {
    layoutGraph.current = { graph, signature: layoutSignature }
  }
  const layoutGeneration = useRef(0)
  const resetLayoutRequested = useRef(false)
  const previousLayoutDirection = useRef<LayoutDirection | null>(null)
  const flow = useReactFlow<ResourceFlowNode, ResourceFlowEdge>()
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [layoutDirection, setLayoutDirection] =
    useState<LayoutDirection | null>(null)
  const [zoomRange, setZoomRange] = useState({ max: 2.5, min: 0.35 })
  const [edgeMetrics, setEdgeMetrics] = useState<EdgeMetrics | null>(null)
  const [enteringEdgeIds, setEnteringEdgeIds] = useState<ReadonlySet<string>>(
    new Set()
  )
  const [layoutPending, setLayoutPending] = useState(true)
  const [layoutRevision, setLayoutRevision] = useState(0)
  const [layoutPositions, setLayoutPositions] = useState(
    new Map<string, LayoutPosition>()
  )
  const [flowReady, setFlowReady] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [fullscreenError, setFullscreenError] = useState(false)
  const [touchHintVisible, setTouchHintVisible] = useState(false)
  const [flowNodes, setFlowNodes, handleNodesChange] =
    useNodesState<ResourceFlowNode>([])

  const neighboursByNode = useMemo(() => {
    const neighbours = new Map<string, Set<string>>()
    for (const node of graph.nodes) {
      neighbours.set(node.unique_id, new Set([node.unique_id]))
    }
    for (const edge of graph.edges) {
      neighbours.get(edge.source)?.add(edge.target)
      neighbours.get(edge.target)?.add(edge.source)
    }
    return neighbours
  }, [graph.edges, graph.nodes])

  const activeHighlightMfid = hoveredNode ?? highlightedMfid ?? null
  const activeNeighbours = activeHighlightMfid
    ? neighboursByNode.get(activeHighlightMfid)
    : undefined

  const requestExpansion = useCallback(
    (nodeMfid: string, mode: GraphExpansionMode) => {
      const state = graphExpansionState(expansionStates, nodeMfid, mode)
      pendingExpansionAnchor.current = {
        layoutSignature,
        mode,
        nodeMfid,
        requestStarted: graphExpansionPending(state),
        retry: Boolean(state?.isError),
      }
      onExpand(nodeMfid, mode)
    },
    [expansionStates, layoutSignature, onExpand]
  )
  const nodePresentation = useRef<ResourceFlowNodePresentation | null>(null)
  nodePresentation.current = layoutDirection
    ? {
        activeHighlightMfid,
        activeNeighbours,
        displayThumbnails: display.thumbnails,
        expansionModesByNode,
        expansionStates,
        inspectedMfid,
        layoutDirection,
        onExpand: requestExpansion,
        portalContainer: fullscreen ? surface : undefined,
        rootContext,
        thumbnails,
      }
    : null

  useEffect(() => {
    const element = surface.current
    if (!element) return
    const updateDirection = () => {
      setLayoutDirection(resolveLayoutDirection(display.orientation))
      const nextEdgeMetrics = {
        cornerRadius: graphNumberToken(element, "--graph-edge-corner-radius"),
        markerSize: graphNumberToken(element, "--graph-arrow-size"),
      }
      setEdgeMetrics((current) =>
        current?.cornerRadius === nextEdgeMetrics.cornerRadius &&
        current.markerSize === nextEdgeMetrics.markerSize
          ? current
          : nextEdgeMetrics
      )
      const nextZoomRange = {
        max: graphNumberToken(element, "--graph-max-zoom"),
        min: graphNumberToken(element, "--graph-min-zoom"),
      }
      setZoomRange((current) =>
        current.max === nextZoomRange.max && current.min === nextZoomRange.min
          ? current
          : nextZoomRange
      )
    }
    updateDirection()
    const resizeObserver = new ResizeObserver(updateDirection)
    resizeObserver.observe(element)
    return () => resizeObserver.disconnect()
  }, [display.orientation])

  useEffect(() => {
    const updateFullscreen = () => {
      setFullscreen(document.fullscreenElement === surface.current)
      setFullscreenError(false)
      setTouchHintVisible(false)
      requestAnimationFrame(() => {
        void flow.fitView({
          ...graphViewportOptions(surface.current),
          maxZoom: 1,
          padding: 0.16,
        })
      })
    }
    document.addEventListener("fullscreenchange", updateFullscreen)
    return () =>
      document.removeEventListener("fullscreenchange", updateFullscreen)
  }, [flow])

  useEffect(() => {
    const element = surface.current
    if (!element) return
    let hintTimer: ReturnType<typeof setTimeout> | undefined
    let singleTouch: {
      moved: boolean
      startTime: number
      startX: number
      startY: number
    } | null = null
    let lastTap: {
      clientX: number
      clientY: number
      time: number
    } | null = null
    let doubleTapZoom: {
      centerX: number
      centerY: number
      moved: boolean
      nodeMfid: string | null
      startViewportX: number
      startViewportY: number
      startY: number
      startZoom: number
    } | null = null

    const clearHintTimer = () => {
      if (hintTimer !== undefined) {
        clearTimeout(hintTimer)
        hintTimer = undefined
      }
    }

    const showTouchHint = () => {
      clearHintTimer()
      setTouchHintVisible(true)
      hintTimer = setTimeout(() => {
        setTouchHintVisible(false)
        hintTimer = undefined
      }, 1800)
    }

    const isInteractiveControl = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      Boolean(
        target.closest(
          ".resource-graph-controls, .resource-graph-expansion-action"
        )
      )

    const handleTouchStart = (event: TouchEvent) => {
      if (isInteractiveControl(event.target)) return
      const isFullscreen = document.fullscreenElement === element
      if (event.touches.length >= 2) {
        singleTouch = null
        doubleTapZoom = null
        element.dataset.touchGestureActive = ""
        clearHintTimer()
        setTouchHintVisible(false)
        return
      }
      if (event.touches.length !== 1) return
      const touch = event.touches[0]
      const now = performance.now()
      if (
        lastTap &&
        now - lastTap.time <= 320 &&
        Math.hypot(
          touch.clientX - lastTap.clientX,
          touch.clientY - lastTap.clientY
        ) <= 28
      ) {
        const viewport = flow.getViewport()
        const rect = element.getBoundingClientRect()
        const tappedNode =
          event.target instanceof HTMLElement
            ? event.target.closest<HTMLElement>(".react-flow__node-resource")
            : null
        doubleTapZoom = {
          centerX: touch.clientX - rect.left,
          centerY: touch.clientY - rect.top,
          moved: false,
          nodeMfid: tappedNode?.dataset.id ?? null,
          startViewportX: viewport.x,
          startViewportY: viewport.y,
          startY: touch.clientY,
          startZoom: viewport.zoom,
        }
        singleTouch = null
        lastTap = null
        element.dataset.touchGestureActive = ""
        clearHintTimer()
        setTouchHintVisible(false)
        event.stopPropagation()
        return
      }
      doubleTapZoom = null
      singleTouch = {
        moved: false,
        startTime: now,
        startX: touch.clientX,
        startY: touch.clientY,
      }
      if (!isFullscreen) {
        delete element.dataset.touchGestureActive
        event.stopPropagation()
      }
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (isInteractiveControl(event.target)) return
      const isFullscreen = document.fullscreenElement === element
      if (event.touches.length >= 2) {
        doubleTapZoom = null
        singleTouch = null
        element.dataset.touchGestureActive = ""
        clearHintTimer()
        setTouchHintVisible(false)
        return
      }
      if (event.touches.length !== 1) return
      const touch = event.touches[0]
      if (doubleTapZoom) {
        const deltaY = touch.clientY - doubleTapZoom.startY
        if (Math.abs(deltaY) > 4 || doubleTapZoom.moved) {
          doubleTapZoom.moved = true
          event.preventDefault()
          event.stopPropagation()
          const nextZoom = Math.min(
            zoomRange.max,
            Math.max(
              zoomRange.min,
              doubleTapZoom.startZoom * Math.pow(2, deltaY / 140)
            )
          )
          const graphX =
            (doubleTapZoom.centerX - doubleTapZoom.startViewportX) /
            doubleTapZoom.startZoom
          const graphY =
            (doubleTapZoom.centerY - doubleTapZoom.startViewportY) /
            doubleTapZoom.startZoom
          void flow.setViewport(
            {
              x: doubleTapZoom.centerX - graphX * nextZoom,
              y: doubleTapZoom.centerY - graphY * nextZoom,
              zoom: nextZoom,
            },
            { duration: 0 }
          )
        }
        return
      }
      if (singleTouch) {
        const distance = Math.hypot(
          touch.clientX - singleTouch.startX,
          touch.clientY - singleTouch.startY
        )
        if (distance > 12 && !singleTouch.moved) {
          singleTouch.moved = true
          if (!isFullscreen) {
            showTouchHint()
          }
        }
      }
      if (!isFullscreen) {
        event.stopPropagation()
      }
    }

    const handleTouchEnd = (event: TouchEvent) => {
      if (event.touches.length > 0) {
        if (
          document.fullscreenElement !== element &&
          event.touches.length === 1 &&
          !doubleTapZoom
        ) {
          delete element.dataset.touchGestureActive
        }
        return
      }
      delete element.dataset.touchGestureActive
      const now = performance.now()
      if (doubleTapZoom) {
        if (!doubleTapZoom.moved && doubleTapZoom.nodeMfid) {
          const position = displayedPositions.current.get(
            doubleTapZoom.nodeMfid
          )
          if (position) {
            void flow.setCenter(
              position.x + position.width / 2,
              position.y + position.height / 2,
              {
                ...graphViewportOptions(element),
                zoom: flow.getZoom(),
              }
            )
          }
        }
        doubleTapZoom = null
        return
      }
      if (
        singleTouch &&
        !singleTouch.moved &&
        now - singleTouch.startTime <= 300
      ) {
        lastTap = {
          clientX: singleTouch.startX,
          clientY: singleTouch.startY,
          time: now,
        }
      } else {
        lastTap = null
      }
      singleTouch = null
    }

    element.addEventListener("touchstart", handleTouchStart, {
      capture: true,
      passive: true,
    })
    element.addEventListener("touchmove", handleTouchMove, {
      capture: true,
      passive: false,
    })
    element.addEventListener("touchend", handleTouchEnd, {
      capture: true,
      passive: true,
    })
    element.addEventListener("touchcancel", handleTouchEnd, {
      capture: true,
      passive: true,
    })
    return () => {
      clearHintTimer()
      delete element.dataset.touchGestureActive
      element.removeEventListener("touchstart", handleTouchStart, true)
      element.removeEventListener("touchmove", handleTouchMove, true)
      element.removeEventListener("touchend", handleTouchEnd, true)
      element.removeEventListener("touchcancel", handleTouchEnd, true)
    }
  }, [flow, zoomRange.max, zoomRange.min])

  useEffect(() => {
    const element = surface.current
    if (!element || !flowReady || !layoutDirection) return
    const currentGraph = layoutGraph.current.graph
    const requestedAnchor = pendingExpansionAnchor.current
    const resetLayout = resetLayoutRequested.current
    resetLayoutRequested.current = false
    const directionChanged =
      previousLayoutDirection.current !== null &&
      previousLayoutDirection.current !== layoutDirection
    previousLayoutDirection.current = layoutDirection
    const generation = layoutGeneration.current + 1
    layoutGeneration.current = generation
    cancelAnimationFrameRef(layoutAnimationFrame)
    cancelAnimationFrameRef(entryRevealFrame)
    setHoveredNode(null)
    setFlowNodes((current) => clearEnteringFlowNodes(current))
    setEnteringEdgeIds(new Set())
    setLayoutPending(true)
    const previousPositions = displayedPositions.current
    const initialPositions =
      previousPositions.size > 0 && !resetLayout && !directionChanged
        ? previousPositions
        : null
    const applyLayout = (rawPositions: Map<string, LayoutPosition>) => {
      if (layoutGeneration.current !== generation) return
      const presentation = nodePresentation.current
      if (!presentation) return
      const expansionAnchor =
        requestedAnchor && requestedAnchor.layoutSignature !== layoutSignature
          ? requestedAnchor.nodeMfid
          : null
      const anchorMfid = expansionAnchor ?? currentGraph.rootMfid
      const nextPositions =
        previousPositions.size > 0 && !resetLayout && !directionChanged
          ? alignLayoutToAnchor(rawPositions, previousPositions, anchorMfid)
          : rawPositions
      const nextEdgeIds = new Set(currentGraph.edges.map((edge) => edge.id))
      const newNodeIds = new Set(
        currentGraph.nodes
          .map((node) => node.unique_id)
          .filter((nodeMfid) => !previousPositions.has(nodeMfid))
      )
      const newEdgeIds = new Set(
        [...nextEdgeIds].filter((edgeId) => !visibleEdgeIds.current.has(edgeId))
      )
      const duration = graphViewportOptions(element).duration
      const firstLayout = previousPositions.size === 0
      visibleEdgeIds.current = nextEdgeIds

      if (firstLayout || resetLayout || directionChanged || duration === 0) {
        displayedPositions.current = nextPositions
        setEnteringEdgeIds(new Set())
        setLayoutPositions(nextPositions)
        setFlowNodes((current) =>
          reconcileResourceFlowNodes(
            current,
            currentGraph,
            nextPositions,
            presentation,
            new Set()
          )
        )
        if (firstLayout || resetLayout || directionChanged) {
          centerResourceGraph(
            flow,
            element,
            currentGraph.rootMfid,
            nextPositions,
            !firstLayout
          )
        }
        setLayoutPending(false)
        return
      }

      const startPositions = layoutAnimationStartPositions(
        previousPositions,
        nextPositions,
        anchorMfid
      )
      displayedPositions.current = startPositions
      setEnteringEdgeIds(newEdgeIds)
      setLayoutPositions(nextPositions)
      setFlowNodes((current) =>
        reconcileResourceFlowNodes(
          current,
          currentGraph,
          startPositions,
          presentation,
          newNodeIds
        )
      )
      scheduleEntryReveal(
        entryRevealFrame,
        generation,
        layoutGeneration,
        () => {
          setFlowNodes((current) => clearEnteringFlowNodes(current))
          setEnteringEdgeIds(new Set())
        }
      )
      const startedAt = performance.now()
      const animate = (now: number) => {
        if (layoutGeneration.current !== generation) return
        const progress = Math.min((now - startedAt) / duration, 1)
        const positions = interpolateLayoutPositions(
          startPositions,
          nextPositions,
          easeOutCubic(progress)
        )
        displayedPositions.current = positions
        setFlowNodes((current) =>
          updateResourceFlowNodePositions(current, positions)
        )
        if (progress < 1) {
          layoutAnimationFrame.current = requestAnimationFrame(animate)
          return
        }
        layoutAnimationFrame.current = null
        displayedPositions.current = nextPositions
        setLayoutPending(false)
      }
      layoutAnimationFrame.current = requestAnimationFrame(animate)
    }

    void layoutResourceGraph(
      currentGraph,
      element,
      layoutDirection,
      initialPositions
    ).then(applyLayout, () =>
      applyLayout(
        fallbackResourceGraphLayout(currentGraph, element, layoutDirection)
      )
    )
  }, [
    flow,
    flowReady,
    layoutDirection,
    layoutRevision,
    layoutSignature,
    setFlowNodes,
  ])

  useEffect(() => {
    const anchor = pendingExpansionAnchor.current
    if (!anchor) return
    const state = graphExpansionState(
      expansionStates,
      anchor.nodeMfid,
      anchor.mode
    )
    if (graphExpansionPending(state)) {
      anchor.requestStarted = true
      return
    }
    if (
      state?.isSuccess ||
      (state?.isError && (!anchor.retry || anchor.requestStarted))
    ) {
      pendingExpansionAnchor.current = null
    }
  }, [expansionStates])

  useEffect(
    () => () => {
      layoutGeneration.current += 1
      cancelAnimationFrameRef(layoutAnimationFrame)
      cancelAnimationFrameRef(entryRevealFrame)
    },
    []
  )

  const resetLayout = useCallback(() => {
    resetResourceGraphLayoutEngine()
    resetLayoutRequested.current = true
    setHoveredNode(null)
    setLayoutRevision((current) => current + 1)
  }, [])

  const toggleFullscreen = useCallback(() => {
    const element = surface.current
    if (!element) return
    setFullscreenError(false)
    if (document.fullscreenElement === element) {
      if (typeof document.exitFullscreen !== "function") {
        setFullscreenError(true)
        return
      }
      void document.exitFullscreen().catch(() => setFullscreenError(true))
      return
    }
    if (typeof element.requestFullscreen !== "function") {
      setFullscreenError(true)
      return
    }
    void element.requestFullscreen().catch(() => setFullscreenError(true))
  }, [])

  useLayoutEffect(() => {
    if (!layoutDirection) return
    const presentation = nodePresentation.current
    if (!presentation) return
    const graphNodes = new Map(
      graph.nodes.map((node) => [node.unique_id, node] as const)
    )
    setFlowNodes((current) =>
      current.map((flowNode) => {
        const node = graphNodes.get(flowNode.id)
        if (!node) return flowNode
        return updateResourceFlowNodePresentation(
          flowNode,
          graph.rootMfid,
          node,
          presentation
        )
      })
    )
  }, [
    activeHighlightMfid,
    activeNeighbours,
    display.thumbnails,
    expansionModesByNode,
    expansionStates,
    fullscreen,
    graph.nodes,
    graph.rootMfid,
    inspectedMfid,
    layoutDirection,
    requestExpansion,
    rootContext,
    setFlowNodes,
    thumbnails,
  ])

  const setHoveredResource = useCallback((nodeMfid: string | null) => {
    setHoveredNode(nodeMfid)
  }, [])

  const persistNodePosition = useCallback((node: ResourceFlowNode) => {
    const previous = displayedPositions.current.get(node.id)
    if (!previous) return
    const next = new Map(displayedPositions.current)
    next.set(node.id, { ...previous, ...node.position })
    displayedPositions.current = next
    setLayoutPositions(next)
  }, [])

  const cancelLayoutForDrag = useCallback(() => {
    layoutGeneration.current += 1
    cancelAnimationFrameRef(layoutAnimationFrame)
    cancelAnimationFrameRef(entryRevealFrame)
    setFlowNodes((current) => clearEnteringFlowNodes(current))
    setEnteringEdgeIds(new Set())
    setLayoutPositions(new Map(displayedPositions.current))
    setLayoutPending(false)
  }, [setFlowNodes])

  const centerGraphNode = useCallback(
    (nodeMfid: string) => {
      const element = surface.current
      const position = displayedPositions.current.get(nodeMfid)
      if (!element || !position) return
      void flow.setCenter(
        position.x + position.width / 2,
        position.y + position.height / 2,
        {
          ...graphViewportOptions(element),
          zoom: flow.getZoom(),
        }
      )
    },
    [flow]
  )

  useEffect(() => {
    if (!focusRequest || !flowReady || layoutPending) return
    if (lastHandledFocusNonce.current === focusRequest.nonce) return
    lastHandledFocusNonce.current = focusRequest.nonce
    centerGraphNode(focusRequest.mfid)
  }, [centerGraphNode, flowReady, focusRequest, layoutPending])

  const handleInit = useCallback(() => setFlowReady(true), [])
  const handleNodeClick = useCallback<NodeMouseHandler<ResourceFlowNode>>(
    (event, node) => {
      if (event.currentTarget instanceof HTMLElement) {
        onInspect(node.id, event.currentTarget)
      }
    },
    [onInspect]
  )
  const handleNodeDoubleClick = useCallback<NodeMouseHandler<ResourceFlowNode>>(
    (event, node) => {
      event.preventDefault()
      event.stopPropagation()
      centerGraphNode(node.id)
    },
    [centerGraphNode]
  )
  const handleGraphKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        !(event.target instanceof HTMLElement)
      ) {
        return
      }
      const key = event.key.toLocaleLowerCase()
      if (key !== "f" && event.key !== "Enter" && event.key !== " ") {
        return
      }
      const node = event.target.closest<HTMLElement>(
        ".react-flow__node-resource"
      )
      if (!node || event.target !== node) return
      const nodeMfid = node.dataset.id
      if (!nodeMfid) return
      event.preventDefault()
      if (key === "f") {
        centerGraphNode(nodeMfid)
        return
      }
      onInspect(nodeMfid, node)
    },
    [centerGraphNode, onInspect]
  )
  const handleNodeDragStop = useCallback<OnNodeDrag<ResourceFlowNode>>(
    (_event, node) => persistNodePosition(node),
    [persistNodePosition]
  )
  const handleNodeDragStart = useCallback<OnNodeDrag<ResourceFlowNode>>(
    () => cancelLayoutForDrag(),
    [cancelLayoutForDrag]
  )
  const handleNodeMouseEnter = useCallback<NodeMouseHandler<ResourceFlowNode>>(
    (_event, node) => setHoveredResource(node.id),
    [setHoveredResource]
  )
  const handleNodeMouseLeave = useCallback<NodeMouseHandler<ResourceFlowNode>>(
    () => setHoveredResource(null),
    [setHoveredResource]
  )

  const flowEdges = useMemo<ResourceFlowEdge[]>(
    () =>
      graph.edges.flatMap((edge) => {
        const sourcePosition = layoutPositions.get(edge.source)
        const targetPosition = layoutPositions.get(edge.target)
        if (!edgeMetrics || !sourcePosition || !targetPosition) {
          return []
        }
        const highlighted = Boolean(
          activeHighlightMfid &&
          (edge.source === activeHighlightMfid ||
            edge.target === activeHighlightMfid)
        )
        const dimmed = Boolean(activeHighlightMfid && !highlighted)
        const edgeColor = highlighted
          ? "var(--graph-highlight)"
          : "var(--graph-edge)"
        const isAssociated = edge.relationship === "associated"
        const associationHandles = isAssociated
          ? resolveAssociationHandleIds(sourcePosition, targetPosition)
          : null
        const sourceHandle = associationHandles
          ? associationHandles.sourceHandle
          : "lineage-source"
        const targetHandle = associationHandles
          ? associationHandles.targetHandle
          : "lineage-target"
        return [
          {
            animated: false,
            className: [
              `resource-graph-edge-${edge.relationship}`,
              enteringEdgeIds.has(edge.id)
                ? "resource-graph-edge-entering"
                : "",
              highlighted ? "resource-graph-edge-highlighted" : "",
              dimmed ? "resource-graph-edge-dimmed" : "",
            ]
              .filter(Boolean)
              .join(" "),
            data: { highlighted, relationship: edge.relationship },
            deletable: false,
            id: edge.id,
            markerEnd:
              edge.relationship === "parent"
                ? {
                    color: edgeColor,
                    height: edgeMetrics.markerSize,
                    type: MarkerType.ArrowClosed,
                    width: edgeMetrics.markerSize,
                  }
                : undefined,
            pathOptions:
              edge.relationship === "parent"
                ? { borderRadius: edgeMetrics.cornerRadius }
                : undefined,
            reconnectable: false,
            selectable: false,
            source: edge.source,
            sourceHandle,
            target: edge.target,
            targetHandle,
            type: isAssociated ? "default" : "smoothstep",
          },
        ]
      }),
    [
      activeHighlightMfid,
      edgeMetrics,
      enteringEdgeIds,
      graph.edges,
      layoutPositions,
    ]
  )

  return (
    <div
      className="resource-graph-surface relative overflow-hidden rounded-xl border bg-card"
      data-density={graphDensity(graph.nodes.length)}
      data-resource-preview-trigger=""
      ref={surface}
    >
      <GraphViewportControls
        display={display}
        flow={flow}
        fullscreen={fullscreen}
        graph={graph}
        onResetLayout={resetLayout}
        onDisplayChange={onDisplayChange}
        onToggleFullscreen={toggleFullscreen}
        positions={layoutPositions}
        surface={surface}
      />
      <ReactFlow<ResourceFlowNode, ResourceFlowEdge>
        aria-describedby="resource-graph-instructions"
        aria-label={`Graph of ${graph.nodes.length} resources and ${graph.edges.length} relationships`}
        colorMode={theme}
        className="resource-graph-canvas"
        edges={flowEdges}
        edgesFocusable={false}
        elementsSelectable={false}
        maxZoom={zoomRange.max}
        minZoom={zoomRange.min}
        nodeTypes={nodeTypes}
        nodes={flowNodes}
        nodesConnectable={false}
        nodesDraggable
        onKeyDown={handleGraphKeyDown}
        onInit={handleInit}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onNodesChange={handleNodesChange}
        onNodeClick={handleNodeClick}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        onlyRenderVisibleElements={
          graph.nodes.length >= GRAPH_VIEWPORT_CULLING_NODE_THRESHOLD
        }
        preventScrolling={false}
        proOptions={reactFlowProOptions}
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
      >
        <Background
          color="var(--graph-grid)"
          gap={20}
          size={1}
          variant={BackgroundVariant.Dots}
        />
      </ReactFlow>
      <span className="sr-only" id="resource-graph-instructions">
        The current resource is centered. Lineage flows from parent to child
        from top to bottom unless horizontal orientation is selected. Dashed
        edges show sample and dataset associations. Expansion controls load
        ancestors, descendants, or associated resources. Nodes can be
        repositioned by dragging. Hold Control, or Command on macOS, while
        scrolling to zoom. On touch screens, use two fingers to pan or pinch to
        zoom, or double-tap and hold then drag vertically to zoom. Double-click
        a node, or focus it and press F, to center it. Reset layout restores the
        ELK arrangement. The relationship table following the graph provides the
        same resources with keyboard-accessible inspection and navigation.
      </span>
      {touchHintVisible && !fullscreen ? (
        <div
          aria-live="polite"
          className="resource-graph-touch-hint pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 rounded-lg border bg-card/95 px-3 py-1.5 text-label-compact text-foreground shadow-sm"
          role="status"
        >
          Use two fingers to move the graph
        </div>
      ) : null}
      {fullscreenError ? (
        <div
          className="resource-graph-layout-status absolute right-3 bottom-3 rounded-lg border border-destructive/40 bg-card px-2 py-1 text-label-compact text-destructive shadow-sm"
          role="alert"
        >
          Fullscreen is unavailable.
        </div>
      ) : loading || layoutPending ? (
        <div
          className="resource-graph-layout-status absolute right-3 bottom-3 flex items-center gap-1.5 rounded-lg border bg-card px-2 py-1 text-label-compact shadow-sm"
          role="status"
        >
          <PendingIcon />
          {loading ? "Loading" : "Arranging"}
        </div>
      ) : null}
      <ResourceGraphLegend associationsVisible={display.associations} />
    </div>
  )
}

const ResourceGraphNode = memo(function ResourceGraphNodeComponent({
  data,
}: NodeProps<ResourceFlowNode>) {
  const expansionModes = graphExpansionModesForNode(
    data.node,
    data.expansionStates,
    data.expansionModes
  )
  return (
    <div
      className="resource-graph-flow-node"
      data-dimmed={data.dimmed ? "" : undefined}
      data-entering={data.entering ? "" : undefined}
      data-highlighted={data.highlighted ? "" : undefined}
      data-inspected={data.inspected ? "" : undefined}
      data-kind={data.node.kind}
      data-layout-direction={data.layoutDirection}
      data-root={data.isRoot ? "" : undefined}
      data-thumbnail={data.thumbnail ? "" : undefined}
    >
      <Handle
        className="resource-graph-handle"
        id="lineage-target"
        position={
          data.layoutDirection === "DOWN" ? Position.Top : Position.Left
        }
        type="target"
      />
      <Handle
        className="resource-graph-handle"
        id="lineage-source"
        position={
          data.layoutDirection === "DOWN" ? Position.Bottom : Position.Right
        }
        type="source"
      />
      <Handle
        className="resource-graph-handle resource-graph-handle-association-source"
        id="association-source-top"
        position={Position.Top}
        type="source"
      />
      <Handle
        className="resource-graph-handle resource-graph-handle-association-source"
        id="association-source-right"
        position={Position.Right}
        type="source"
      />
      <Handle
        className="resource-graph-handle resource-graph-handle-association-source"
        id="association-source-bottom"
        position={Position.Bottom}
        type="source"
      />
      <Handle
        className="resource-graph-handle resource-graph-handle-association-source"
        id="association-source-left"
        position={Position.Left}
        type="source"
      />
      <Handle
        className="resource-graph-handle resource-graph-handle-association-target"
        id="association-target-top"
        position={Position.Top}
        type="target"
      />
      <Handle
        className="resource-graph-handle resource-graph-handle-association-target"
        id="association-target-right"
        position={Position.Right}
        type="target"
      />
      <Handle
        className="resource-graph-handle resource-graph-handle-association-target"
        id="association-target-bottom"
        position={Position.Bottom}
        type="target"
      />
      <Handle
        className="resource-graph-handle resource-graph-handle-association-target"
        id="association-target-left"
        position={Position.Left}
        type="target"
      />
      <div className="resource-graph-flow-node-content">
        <div
          className="resource-graph-flow-node-icon-badge"
          aria-label={
            data.isRoot ? `Current ${data.node.kind}` : data.node.kind
          }
          title={data.isRoot ? `Current ${data.node.kind}` : data.node.kind}
        >
          <ResourceTypeIcon
            className="resource-graph-flow-node-icon"
            type={data.node.kind}
          />
        </div>
        <div className="resource-graph-flow-node-body">
          {data.isRoot ? (
            <span className="resource-graph-flow-node-eyebrow">Current</span>
          ) : null}
          <span
            className="resource-graph-flow-node-name"
            title={data.node.name}
          >
            <BreakableText value={data.node.name} />
          </span>
          {data.context ? (
            <span
              className="resource-graph-flow-node-context"
              title={data.context}
            >
              {data.context}
            </span>
          ) : null}
        </div>
        {data.thumbnail ? (
          <DatasetThumbnailImage
            alt=""
            className="resource-graph-flow-node-thumbnail"
            decoding="async"
            loading="lazy"
            thumbnail={data.thumbnail}
          />
        ) : null}
      </div>
      {expansionModes.length > 0 ? (
        <GraphNodeExpansionControls
          modes={expansionModes}
          expansionStates={data.expansionStates}
          layoutDirection={data.layoutDirection}
          node={data.node}
          onExpand={data.onExpand}
          portalContainer={data.portalContainer}
        />
      ) : null}
    </div>
  )
})

const nodeTypes = { resource: ResourceGraphNode }

function GraphNodeExpansionControls({
  modes,
  expansionStates,
  layoutDirection,
  node,
  onExpand,
  portalContainer,
}: {
  modes: readonly GraphExpansionMode[]
  expansionStates: ReadonlyMap<string, GraphExpansionState>
  layoutDirection: LayoutDirection
  node: WorkspaceResourceGraphNode
  onExpand: (nodeMfid: string, mode: GraphExpansionMode) => void
  portalContainer?: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <>
      {modes.map((mode) => (
        <GraphNodeExpansionAction
          key={mode}
          layoutDirection={layoutDirection}
          mode={mode}
          node={node}
          onExpand={onExpand}
          portalContainer={portalContainer}
          state={graphExpansionState(expansionStates, node.unique_id, mode)}
        />
      ))}
    </>
  )
}

function GraphNodeExpansionAction({
  mode,
  layoutDirection,
  node,
  onExpand,
  portalContainer,
  state,
}: {
  mode: GraphExpansionMode
  layoutDirection: LayoutDirection
  node: WorkspaceResourceGraphNode
  onExpand: (nodeMfid: string, mode: GraphExpansionMode) => void
  portalContainer?: React.RefObject<HTMLDivElement | null>
  state?: GraphExpansionState
}) {
  const pending = graphExpansionPending(state)
  const Icon = graphExpansionIcon(mode, layoutDirection)
  const modeLabel = graphExpansionModeLabel(mode)
  const label = state?.isError
    ? `Retry loading ${modeLabel.toLowerCase()} from ${node.name}`
    : `Load ${modeLabel.toLowerCase()} from ${node.name}`
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            className={cn(
              "nodrag nopan resource-graph-expansion-action",
              `resource-graph-expansion-${mode}`
            )}
            data-error={state?.isError ? "" : undefined}
            data-pending={pending ? "" : undefined}
            disabled={pending}
            onClick={(event) => {
              event.stopPropagation()
              onExpand(node.unique_id, mode)
            }}
            size="icon-circle"
            type="button"
            variant={state?.isError ? "destructive" : "graph"}
          />
        }
      >
        {pending ? <PendingIcon /> : <Icon aria-hidden="true" />}
      </TooltipTrigger>
      <TooltipContent portalContainer={portalContainer}>{label}</TooltipContent>
    </Tooltip>
  )
}

function graphExpansionIcon(
  mode: GraphExpansionMode,
  layoutDirection: LayoutDirection
) {
  if (layoutDirection === "DOWN") {
    if (mode === "ancestors") return GraphAncestorsVerticalIcon
    if (mode === "descendants") return GraphDescendantsVerticalIcon
  }
  if (mode === "ancestors") return GraphAncestorsIcon
  if (mode === "descendants") return GraphDescendantsIcon
  return GraphAssociationsIcon
}

function GraphViewportControls({
  display,
  flow,
  fullscreen,
  graph,
  onResetLayout,
  onDisplayChange,
  onToggleFullscreen,
  positions,
  surface,
}: {
  display: ResourceGraphDisplay
  flow: ReactFlowInstance<ResourceFlowNode, ResourceFlowEdge>
  fullscreen: boolean
  graph: WorkspaceResourceGraph
  onResetLayout: () => void
  onDisplayChange: (changes: Partial<ResourceGraphDisplay>) => void
  onToggleFullscreen: () => void
  positions: ReadonlyMap<string, LayoutPosition>
  surface: React.RefObject<HTMLDivElement | null>
}) {
  const portalContainer = fullscreen ? surface : undefined
  return (
    <div className="resource-graph-controls absolute top-3 right-3 flex gap-2">
      <ButtonGroup aria-label="Graph viewport controls">
        <GraphControl
          label="Zoom graph out"
          onClick={() =>
            void flow.zoomOut(graphViewportOptions(surface.current))
          }
          portalContainer={portalContainer}
        >
          <ZoomOutGraphIcon aria-hidden="true" />
        </GraphControl>
        <GraphControl
          label="Zoom graph in"
          onClick={() =>
            void flow.zoomIn(graphViewportOptions(surface.current))
          }
          portalContainer={portalContainer}
        >
          <ZoomInGraphIcon aria-hidden="true" />
        </GraphControl>
        <GraphControl
          label="Fit all resources"
          onClick={() =>
            void flow.fitView({
              ...graphViewportOptions(surface.current),
              maxZoom: 1,
              padding: 0.16,
            })
          }
          portalContainer={portalContainer}
        >
          <FitGraphIcon aria-hidden="true" />
        </GraphControl>
        <GraphControl
          label="Center current resource"
          onClick={() => {
            const element = surface.current
            if (element) {
              centerResourceGraph(
                flow,
                element,
                graph.rootMfid,
                positions,
                true
              )
            }
          }}
          portalContainer={portalContainer}
        >
          <ExploreGraphFocusIcon aria-hidden="true" />
        </GraphControl>
      </ButtonGroup>
      <GraphDisplayMenu
        display={display}
        flow={flow}
        graph={graph}
        onDisplayChange={onDisplayChange}
        onResetLayout={onResetLayout}
        portalContainer={portalContainer}
        positions={positions}
        surface={surface}
      />
      <GraphControl
        label={fullscreen ? "Exit fullscreen graph" : "View graph fullscreen"}
        onClick={onToggleFullscreen}
        portalContainer={portalContainer}
        pressed={fullscreen}
      >
        {fullscreen ? (
          <ExitGraphFullscreenIcon aria-hidden="true" />
        ) : (
          <EnterGraphFullscreenIcon aria-hidden="true" />
        )}
      </GraphControl>
    </div>
  )
}

function GraphDisplayMenu({
  display,
  flow,
  graph,
  onDisplayChange,
  onResetLayout,
  portalContainer,
  positions,
  surface,
}: {
  display: ResourceGraphDisplay
  flow: ReactFlowInstance<ResourceFlowNode, ResourceFlowEdge>
  graph: WorkspaceResourceGraph
  onDisplayChange: (changes: Partial<ResourceGraphDisplay>) => void
  onResetLayout: () => void
  portalContainer?: React.RefObject<HTMLDivElement | null>
  positions: ReadonlyMap<string, LayoutPosition>
  surface: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label="Graph options"
                  size="icon-sm"
                  type="button"
                  variant="outline"
                />
              }
            />
          }
        >
          <GraphDisplayOptionsIcon aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent portalContainer={portalContainer}>
          Graph options
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="end"
        className="min-w-44"
        portalContainer={portalContainer}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>Layout</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => {
              const element = surface.current
              if (element) {
                centerResourceGraph(
                  flow,
                  element,
                  graph.rootMfid,
                  positions,
                  true
                )
              }
            }}
          >
            <ExploreGraphFocusIcon aria-hidden="true" />
            Center current resource
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onResetLayout}>
            <ResetGraphLayoutIcon aria-hidden="true" />
            Reset layout
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Show</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={display.associations}
            onCheckedChange={(checked) =>
              onDisplayChange({ associations: checked })
            }
          >
            Associations
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={display.thumbnails}
            onCheckedChange={(checked) =>
              onDisplayChange({ thumbnails: checked })
            }
          >
            Dataset thumbnails
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          onValueChange={(value) => {
            if (value === "horizontal" || value === "vertical") {
              onDisplayChange({ orientation: value })
            }
          }}
          value={display.orientation}
        >
          <DropdownMenuLabel>Orientation</DropdownMenuLabel>
          <DropdownMenuRadioItem value="horizontal">
            Horizontal
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="vertical">
            Vertical
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function GraphControl({
  children,
  label,
  onClick,
  portalContainer,
  pressed,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  portalContainer?: React.RefObject<HTMLDivElement | null>
  pressed?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            aria-pressed={pressed}
            onClick={onClick}
            size="icon-sm"
            type="button"
            variant="outline"
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent portalContainer={portalContainer}>{label}</TooltipContent>
    </Tooltip>
  )
}

function ResourceGraphLegend({
  associationsVisible,
}: {
  associationsVisible: boolean
}) {
  return (
    <div
      aria-label="Graph legend"
      className="resource-graph-legend absolute bottom-3 left-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-supporting text-muted-foreground"
    >
      <span className="flex items-center gap-1.5">
        <ResourceTypeIcon type="sample" /> Sample
      </span>
      <span className="flex items-center gap-1.5">
        <ResourceTypeIcon type="dataset" /> Dataset
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="resource-graph-legend-current" />{" "}
        Current
      </span>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="resource-graph-legend-edge resource-graph-legend-edge-lineage"
        />{" "}
        Lineage
      </span>
      {associationsVisible ? (
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="resource-graph-legend-edge resource-graph-legend-edge-associated"
          />{" "}
          Associated
        </span>
      ) : null}
    </div>
  )
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
    resetResourceGraphLayoutEngine()
    throw error
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

function reconcileResourceFlowNodes(
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
  return {
    ...flowNode,
    ariaLabel: resourceFlowNodeAriaLabel(node),
    data: resourceFlowNodeData(
      rootMfid,
      node,
      presentation,
      flowNode.data.entering
    ),
    focusable: true,
    sourcePosition:
      presentation.layoutDirection === "DOWN"
        ? Position.Bottom
        : Position.Right,
    targetPosition:
      presentation.layoutDirection === "DOWN" ? Position.Top : Position.Left,
  }
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
    expansionStates: presentation.expansionStates,
    expansionModes: presentation.expansionModesByNode.get(node.unique_id) ?? [],
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

function updateResourceFlowNodePositions(
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

function clearEnteringFlowNodes(nodes: ResourceFlowNode[]) {
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

export function fallbackResourceGraphLayout(
  graph: WorkspaceResourceGraph,
  element: HTMLElement,
  direction: LayoutDirection
) {
  const nodeWidth = graphNumberToken(element, "--graph-node-width")
  const nodeHeight = graphNumberToken(element, "--graph-node-height")
  const rootWidth = graphNumberToken(element, "--graph-root-node-width")
  const rootHeight = graphNumberToken(element, "--graph-root-node-height")
  const gap = graphNumberToken(element, "--graph-layout-layer-gap")
  const rootIndex = graph.nodes.findIndex(
    (node) => node.unique_id === graph.rootMfid
  )
  return new Map(
    graph.nodes.map((node, index) => {
      const offset = index - Math.max(rootIndex, 0)
      const width = node.unique_id === graph.rootMfid ? rootWidth : nodeWidth
      const height = node.unique_id === graph.rootMfid ? rootHeight : nodeHeight
      return [
        node.unique_id,
        {
          height,
          width,
          x: direction === "RIGHT" ? offset * (nodeWidth + gap) : 0,
          y: direction === "DOWN" ? offset * (nodeHeight + gap) : 0,
        },
      ]
    })
  )
}

function centerResourceGraph(
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

function alignLayoutToAnchor(
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

function layoutAnimationStartPositions(
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

function interpolateLayoutPositions(
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

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3)
}

function cancelAnimationFrameRef(frame: { current: number | null }) {
  if (frame.current === null) return
  cancelAnimationFrame(frame.current)
  frame.current = null
}

function scheduleEntryReveal(
  frame: { current: number | null },
  generation: number,
  currentGeneration: { current: number },
  reveal: () => void
) {
  frame.current = requestAnimationFrame(() => {
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      if (currentGeneration.current !== generation) return
      reveal()
    })
  })
}

function graphViewportOptions(element: HTMLElement | null) {
  if (
    !element ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return { duration: 0 }
  }
  return {
    duration: graphNumberToken(element, "--graph-layout-duration"),
  }
}

function graphNumberToken(
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

function resolveLayoutDirection(
  orientation: GraphOrientation
): LayoutDirection {
  if (orientation === "horizontal") return "RIGHT"
  return "DOWN"
}

function graphDensity(nodeCount: number) {
  if (nodeCount <= 3) return "sparse"
  if (nodeCount >= 12) return "dense"
  return "standard"
}

function resourceGraphLayoutSignature(graph: WorkspaceResourceGraph) {
  return [
    graph.rootMfid,
    ...graph.nodes.map((node) => node.unique_id),
    ...graph.edges.map(
      (edge) => `${edge.id}:${edge.source}:${edge.target}:${edge.relationship}`
    ),
  ].join("|")
}
