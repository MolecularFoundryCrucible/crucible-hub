import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  Background,
  BackgroundVariant,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
} from "@xyflow/react"
import type { NodeMouseHandler, OnNodeDrag } from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { PendingIcon } from "@/components/crucible/pending-icon"
import { useTheme } from "@/components/theme-provider"
import type {
  WorkspaceDatasetThumbnail,
  WorkspaceResourceGraph,
} from "@/data/crucible/workspace-source"
import { useIsMobile } from "@/hooks/use-mobile"
import { motionEasing } from "@/lib/motion"

import {
  GraphFilterMenu,
  GraphViewToolbar,
  ResourceGraphLegend,
} from "./resource-graph-controls"
import type { ResourceGraphDisplay } from "./resource-graph-display"
import {
  graphExpansionPending,
  graphExpansionState,
} from "./resource-graph-expansion"
import type {
  GraphExpansionMode,
  GraphExpansionState,
} from "./resource-graph-expansion"
import {
  clearEnteringFlowNodes,
  reconcileResourceFlowNodes,
  updateResourceFlowNodePositions,
  presentResourceFlowNodes,
} from "./resource-graph-flow-model"
import type {
  ResourceFlowEdge,
  ResourceFlowNode,
  ResourceFlowNodePresentation,
} from "./resource-graph-flow-model"
import {
  alignLayoutToAnchor,
  centerResourceGraph,
  fallbackResourceGraphLayout,
  graphDensity,
  graphNumberToken,
  graphViewportOptions,
  interpolateLayoutPositions,
  layoutAnimationStartPositions,
  layoutResourceGraph,
  resolveAssociationHandleIds,
  resolveLayoutDirection,
  resourceGraphLayoutSignature,
} from "./resource-graph-layout"
import type { LayoutDirection, LayoutPosition } from "./resource-graph-layout"
import { nodeTypes } from "./resource-graph-node"

export { warmResourceGraphLayoutEngine } from "./resource-graph-layout"

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

const GRAPH_VIEWPORT_CULLING_NODE_THRESHOLD = 100

const graphAriaLabels = {
  "node.a11yDescription.default":
    "Press Enter or Space to inspect this resource, or F to center it.",
  "node.a11yDescription.keyboardDisabled":
    "Press Enter or Space to inspect this resource, or F to center it.",
}

const reactFlowProOptions = { hideAttribution: true }

export function resolveGraphNodeClickAction({
  inspectedMfid,
  nodeMfid,
  selectedMfid,
  twoTapMode,
}: {
  inspectedMfid: string | null
  nodeMfid: string
  selectedMfid: string | null
  twoTapMode: boolean
}): "inspect" | "select" {
  if (!twoTapMode) return "inspect"
  return selectedMfid === nodeMfid || inspectedMfid === nodeMfid
    ? "inspect"
    : "select"
}

/** Drops the engine, or only `failed` when given, so a newer engine survives. */

export const ResourceGraphCanvas = memo(function ResourceGraphCanvasComponent({
  display,
  expansionStates,
  expansionModesByNode,
  focusRequest = null,
  graph,
  hiddenCount = 0,
  highlightedMfid = null,
  inspectedMfid = null,
  loading,
  onExpand,
  onDisplayChange,
  onInspect,
  onReset,
  rootContext,
  thumbnails,
}: {
  display: ResourceGraphDisplay
  expansionStates: ReadonlyMap<string, GraphExpansionState>
  expansionModesByNode: ReadonlyMap<string, readonly GraphExpansionMode[]>
  focusRequest?: { mfid: string; nonce: number } | null
  graph: WorkspaceResourceGraph
  hiddenCount?: number
  highlightedMfid?: string | null
  inspectedMfid?: string | null
  loading: boolean
  onExpand: (nodeMfid: string, mode: GraphExpansionMode) => void
  onDisplayChange: (changes: Partial<ResourceGraphDisplay>) => void
  onInspect: (mfid: string, trigger: HTMLElement) => void
  onReset?: () => void
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
        hiddenCount={hiddenCount}
        highlightedMfid={highlightedMfid}
        inspectedMfid={inspectedMfid}
        loading={loading}
        onExpand={onExpand}
        onDisplayChange={onDisplayChange}
        onInspect={onInspect}
        onReset={onReset}
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
  hiddenCount,
  highlightedMfid,
  inspectedMfid,
  loading,
  onExpand,
  onDisplayChange,
  onInspect,
  onReset,
  rootContext,
  thumbnails,
}: {
  display: ResourceGraphDisplay
  expansionStates: ReadonlyMap<string, GraphExpansionState>
  expansionModesByNode: ReadonlyMap<string, readonly GraphExpansionMode[]>
  focusRequest: { mfid: string; nonce: number } | null
  graph: WorkspaceResourceGraph
  hiddenCount: number
  highlightedMfid: string | null
  inspectedMfid: string | null
  loading: boolean
  onExpand: (nodeMfid: string, mode: GraphExpansionMode) => void
  onDisplayChange: (changes: Partial<ResourceGraphDisplay>) => void
  onInspect: (mfid: string, trigger: HTMLElement) => void
  onReset?: () => void
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
  const latestGraph = useRef(graph)
  useLayoutEffect(() => {
    latestGraph.current = graph
  }, [graph])
  const layoutUnfinished = useRef(false)
  const layoutDroppedByDrag = useRef(false)
  const layoutGeneration = useRef(0)
  const resetLayoutRequested = useRef(false)
  const previousLayoutDirection = useRef<LayoutDirection | null>(null)
  const flow = useReactFlow<ResourceFlowNode, ResourceFlowEdge>()
  const isMobile = useIsMobile()
  const lastTouchTime = useRef(0)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
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

  const validSelectedNode =
    selectedNode && neighboursByNode.has(selectedNode) ? selectedNode : null
  const activeHighlightMfid =
    hoveredNode ?? validSelectedNode ?? highlightedMfid ?? null
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
  const latestRequestExpansion = useRef(requestExpansion)
  useLayoutEffect(() => {
    latestRequestExpansion.current = requestExpansion
  }, [requestExpansion])
  const stableRequestExpansion = useCallback(
    (nodeMfid: string, mode: GraphExpansionMode) =>
      latestRequestExpansion.current(nodeMfid, mode),
    []
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
        onExpand: stableRequestExpansion,
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
    let wasFullscreen = false
    let frame: number | null = null
    const updateFullscreen = () => {
      const isFullscreen = document.fullscreenElement === surface.current
      if (isFullscreen === wasFullscreen) return
      wasFullscreen = isFullscreen
      setFullscreen(isFullscreen)
      setFullscreenError(false)
      setTouchHintVisible(false)
      if (frame !== null) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = null
        void flow.fitView({
          ...graphViewportOptions(surface.current),
          maxZoom: 1,
          padding: 0.16,
        })
      })
    }
    document.addEventListener("fullscreenchange", updateFullscreen)
    return () => {
      document.removeEventListener("fullscreenchange", updateFullscreen)
      if (frame !== null) cancelAnimationFrame(frame)
    }
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
      lastTouchTime.current = performance.now()
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
      const now = lastTouchTime.current
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
      lastTouchTime.current = performance.now()
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
      const now = lastTouchTime.current
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
    const currentGraph = latestGraph.current
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
    layoutUnfinished.current = true
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
        layoutUnfinished.current = false
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
      const ease = motionEasing("--motion-ease-standard")
      const animate = (now: number) => {
        if (layoutGeneration.current !== generation) return
        const progress = Math.min((now - startedAt) / duration, 1)
        const positions = interpolateLayoutPositions(
          startPositions,
          nextPositions,
          ease(progress)
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
        layoutUnfinished.current = false
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
    pendingExpansionAnchor.current = null
    resetLayoutRequested.current = true
    setHoveredNode(null)
    setSelectedNode(null)
    onReset?.()
    setLayoutRevision((current) => current + 1)
  }, [onReset])

  const portalContainer = fullscreen ? surface : undefined
  const zoomIn = useCallback(
    () => void flow.zoomIn(graphViewportOptions(surface.current)),
    [flow]
  )
  const zoomOut = useCallback(
    () => void flow.zoomOut(graphViewportOptions(surface.current)),
    [flow]
  )
  const fitAll = useCallback(
    () =>
      void flow.fitView({
        ...graphViewportOptions(surface.current),
        maxZoom: 1,
        padding: 0.16,
      }),
    [flow]
  )
  const centerCurrent = useCallback(() => {
    const element = surface.current
    if (element) {
      centerResourceGraph(flow, element, graph.rootMfid, layoutPositions, true)
    }
  }, [flow, graph.rootMfid, layoutPositions])

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
    setFlowNodes((current) =>
      presentResourceFlowNodes(current, graph, presentation)
    )
  }, [
    activeHighlightMfid,
    activeNeighbours,
    display.thumbnails,
    expansionModesByNode,
    expansionStates,
    fullscreen,
    graph,
    inspectedMfid,
    layoutDirection,
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

  const inspect = useCallback(
    (nodeMfid: string, trigger: HTMLElement) => {
      // The inspector renders outside the fullscreen element, so leave it first.
      if (document.fullscreenElement === surface.current) {
        void document.exitFullscreen().catch(() => undefined)
      }
      onInspect(nodeMfid, trigger)
    },
    [onInspect]
  )

  const cancelLayoutForDrag = useCallback(() => {
    if (layoutUnfinished.current) layoutDroppedByDrag.current = true
    layoutUnfinished.current = false
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
      const recentTouch =
        lastTouchTime.current > 0 &&
        performance.now() - lastTouchTime.current < 1500
      const coarsePointer =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(hover: none), (pointer: coarse)").matches
      const action = resolveGraphNodeClickAction({
        inspectedMfid,
        nodeMfid: node.id,
        selectedMfid: validSelectedNode,
        twoTapMode: isMobile || recentTouch || coarsePointer,
      })
      setSelectedNode(node.id)
      if (action === "select") {
        return
      }
      if (event.currentTarget instanceof HTMLElement) {
        inspect(node.id, event.currentTarget)
      }
    },
    [inspect, inspectedMfid, isMobile, validSelectedNode]
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
      inspect(nodeMfid, node)
    },
    [centerGraphNode, inspect]
  )
  const handleNodeDragStop = useCallback<OnNodeDrag<ResourceFlowNode>>(
    (_event, node) => {
      persistNodePosition(node)
      if (!layoutDroppedByDrag.current) return
      layoutDroppedByDrag.current = false
      if (
        latestGraph.current.nodes.some(
          (graphNode) => !displayedPositions.current.has(graphNode.unique_id)
        )
      ) {
        setLayoutRevision((current) => current + 1)
      }
    },
    [persistNodePosition]
  )
  const handleNodeDragStart = useCallback<OnNodeDrag<ResourceFlowNode>>(
    () => cancelLayoutForDrag(),
    [cancelLayoutForDrag]
  )
  const handleNodeMouseEnter = useCallback<NodeMouseHandler<ResourceFlowNode>>(
    (_event, node) => {
      if (
        lastTouchTime.current > 0 &&
        performance.now() - lastTouchTime.current < 1500
      ) {
        return
      }
      setHoveredResource(node.id)
    },
    [setHoveredResource]
  )
  const handleNodeMouseLeave = useCallback<NodeMouseHandler<ResourceFlowNode>>(
    () => setHoveredResource(null),
    [setHoveredResource]
  )
  const handlePaneClick = useCallback(() => {
    setSelectedNode(null)
    setHoveredResource(null)
  }, [setHoveredResource])

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
      className="resource-graph-surface relative overflow-hidden rounded-xl border"
      data-density={graphDensity(graph.nodes.length)}
      data-resource-preview-trigger=""
      ref={surface}
    >
      <GraphFilterMenu
        display={display}
        onDisplayChange={onDisplayChange}
        portalContainer={portalContainer}
      />
      <GraphViewToolbar
        display={display}
        fullscreen={fullscreen}
        onCenter={centerCurrent}
        onDisplayChange={onDisplayChange}
        onFit={fitAll}
        onResetLayout={resetLayout}
        onToggleFullscreen={toggleFullscreen}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        portalContainer={portalContainer}
      />
      <ReactFlow<ResourceFlowNode, ResourceFlowEdge>
        aria-describedby="resource-graph-instructions"
        aria-label={`Graph of ${graph.nodes.length} resources and ${graph.edges.length} relationships`}
        ariaLabelConfig={graphAriaLabels}
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
        onPaneClick={handlePaneClick}
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
          size={1.25}
          variant={BackgroundVariant.Dots}
        />
      </ReactFlow>
      <span className="sr-only" id="resource-graph-instructions">
        The current resource is centered. Lineage flows from parent to child
        from top to bottom unless horizontal orientation is selected. Dashed
        edges show sample and dataset associations. Expansion controls load
        ancestors, descendants, or associated resources. Nodes can be
        repositioned by dragging. Hold Control, or Command on macOS, while
        scrolling to zoom. On touch screens, tap a node once to highlight its
        connections and reveal expansion controls, and tap again to inspect it;
        use two fingers to pan or pinch to zoom, or double-tap and hold then
        drag vertically to zoom. Double-click a node, or focus it and press F,
        to center it. Press Enter or Space on a focused node to inspect it.
        Reset graph removes expanded resources and arranges the graph again.
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
      <ResourceGraphLegend display={display} hiddenCount={hiddenCount} />
    </div>
  )
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
