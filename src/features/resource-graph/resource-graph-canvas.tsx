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
  LoadingMoreIcon,
  ResetGraphLayoutIcon,
  ZoomInGraphIcon,
  ZoomOutGraphIcon,
} from "@/components/crucible/icons"
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

type ResourceFlowNodeData = {
  context: string | null
  dimmed: boolean
  entering: boolean
  expansionStates: ReadonlyMap<string, GraphExpansionState>
  expansionModes: readonly GraphExpansionMode[]
  isRoot: boolean
  layoutDirection: LayoutDirection
  node: WorkspaceResourceGraphNode
  onExpand: (nodeMfid: string, mode: GraphExpansionMode) => void
  thumbnail?: WorkspaceDatasetThumbnail
}

type ResourceFlowNode = Node<ResourceFlowNodeData, "resource">

type ResourceFlowEdgeData = {
  highlighted: boolean
  relationship: "associated" | "parent"
}

type ResourceFlowEdge = Edge<ResourceFlowEdgeData>

type LayoutDirection = "DOWN" | "RIGHT"

type LayoutPosition = {
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
  nodeMfid: string
}

const GRAPH_VIEWPORT_CULLING_NODE_THRESHOLD = 100
const reactFlowProOptions = { hideAttribution: true }
let elk: ELKInstance | undefined

function resourceGraphLayoutEngine() {
  elk ??= new ELK({ workerFactory: () => new ELKWorker() })
  return elk
}

export const ResourceGraphCanvas = memo(function ResourceGraphCanvasComponent({
  display,
  expansionStates,
  expansionModesByNode,
  graph,
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
  graph: WorkspaceResourceGraph
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
        graph={graph}
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
  graph,
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
  graph: WorkspaceResourceGraph
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
  const flow = useReactFlow<ResourceFlowNode, ResourceFlowEdge>()
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [layoutDirection, setLayoutDirection] =
    useState<LayoutDirection | null>(null)
  const [zoomRange, setZoomRange] = useState({ max: 2.5, min: 0.35 })
  const [edgeMetrics, setEdgeMetrics] = useState<EdgeMetrics | null>(null)
  const [enteringNodeIds, setEnteringNodeIds] = useState<ReadonlySet<string>>(
    new Set()
  )
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
      requestAnimationFrame(() => {
        void flow.fitView({
          ...graphViewportOptions(surface.current),
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
    if (!element || !flowReady || !layoutDirection) return
    const currentGraph = layoutGraph.current.graph
    const resetLayout = resetLayoutRequested.current
    resetLayoutRequested.current = false
    const generation = layoutGeneration.current + 1
    layoutGeneration.current = generation
    cancelAnimationFrameRef(layoutAnimationFrame)
    cancelAnimationFrameRef(entryRevealFrame)
    setEnteringNodeIds(new Set())
    setEnteringEdgeIds(new Set())
    setLayoutPending(true)
    const applyLayout = (rawPositions: Map<string, LayoutPosition>) => {
      if (layoutGeneration.current !== generation) return
      const previousPositions = displayedPositions.current
      const requestedAnchor = pendingExpansionAnchor.current
      const expansionAnchor =
        requestedAnchor && requestedAnchor.layoutSignature !== layoutSignature
          ? requestedAnchor.nodeMfid
          : null
      const anchorMfid = expansionAnchor ?? currentGraph.rootMfid
      const nextPositions =
        previousPositions.size > 0 && !resetLayout
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
      if (expansionAnchor) pendingExpansionAnchor.current = null

      if (firstLayout || duration === 0) {
        displayedPositions.current = nextPositions
        setEnteringNodeIds(new Set())
        setEnteringEdgeIds(new Set())
        setLayoutPositions(nextPositions)
        if (firstLayout || resetLayout) {
          centerResourceGraph(
            flow,
            element,
            currentGraph.rootMfid,
            nextPositions
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
      setEnteringNodeIds(newNodeIds)
      setEnteringEdgeIds(newEdgeIds)
      setLayoutPositions(startPositions)
      scheduleEntryReveal(
        entryRevealFrame,
        generation,
        layoutGeneration,
        setEnteringNodeIds,
        setEnteringEdgeIds
      )
      if (resetLayout) {
        centerResourceGraph(flow, element, currentGraph.rootMfid, nextPositions)
      }
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
        setLayoutPositions(positions)
        if (progress < 1) {
          layoutAnimationFrame.current = requestAnimationFrame(animate)
          return
        }
        layoutAnimationFrame.current = null
        displayedPositions.current = nextPositions
        setLayoutPositions(nextPositions)
        setLayoutPending(false)
      }
      layoutAnimationFrame.current = requestAnimationFrame(animate)
    }

    void layoutResourceGraph(currentGraph, element, layoutDirection).then(
      applyLayout,
      () =>
        applyLayout(
          fallbackResourceGraphLayout(currentGraph, element, layoutDirection)
        )
    )
  }, [flow, flowReady, layoutDirection, layoutRevision, layoutSignature])

  useEffect(
    () => () => {
      layoutGeneration.current += 1
      cancelAnimationFrameRef(layoutAnimationFrame)
      cancelAnimationFrameRef(entryRevealFrame)
    },
    []
  )

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

  const resetLayout = useCallback(() => {
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

  const requestExpansion = useCallback(
    (nodeMfid: string, mode: GraphExpansionMode) => {
      pendingExpansionAnchor.current = { layoutSignature, nodeMfid }
      onExpand(nodeMfid, mode)
    },
    [layoutSignature, onExpand]
  )

  const calculatedNodes = useMemo<ResourceFlowNode[]>(
    () =>
      graph.nodes.flatMap((node) => {
        const position = layoutPositions.get(node.unique_id)
        if (!position) return []
        return [
          {
            ariaLabel: `${node.kind === "sample" ? "Sample" : "Dataset"}: ${node.name}`,
            connectable: false,
            data: {
              context:
                node.unique_id === graph.rootMfid ? rootContext : node.context,
              dimmed: false,
              entering: enteringNodeIds.has(node.unique_id),
              expansionStates,
              expansionModes: expansionModesByNode.get(node.unique_id) ?? [],
              isRoot: node.unique_id === graph.rootMfid,
              layoutDirection: layoutDirection ?? "RIGHT",
              node,
              onExpand: requestExpansion,
              thumbnail:
                display.thumbnails && node.kind === "dataset"
                  ? thumbnails[node.unique_id]
                  : undefined,
            },
            deletable: false,
            draggable: true,
            focusable: node.unique_id !== graph.rootMfid,
            id: node.unique_id,
            position,
            selectable: false,
            sourcePosition:
              layoutDirection === "DOWN" ? Position.Bottom : Position.Right,
            targetPosition:
              layoutDirection === "DOWN" ? Position.Top : Position.Left,
            type: "resource",
          },
        ]
      }),
    [
      expansionStates,
      expansionModesByNode,
      graph.nodes,
      graph.rootMfid,
      display.thumbnails,
      enteringNodeIds,
      layoutDirection,
      layoutPositions,
      requestExpansion,
      rootContext,
      thumbnails,
    ]
  )
  const [flowNodes, setFlowNodes, handleNodesChange] =
    useNodesState<ResourceFlowNode>(calculatedNodes)

  useLayoutEffect(() => {
    setHoveredNode(null)
    setFlowNodes(calculatedNodes)
  }, [calculatedNodes, setFlowNodes])

  const setHoveredResource = useCallback(
    (nodeMfid: string | null) => {
      const neighbours = nodeMfid ? neighboursByNode.get(nodeMfid) : undefined
      setHoveredNode(nodeMfid)
      setFlowNodes((current) =>
        current.map((node) => {
          const dimmed = Boolean(neighbours && !neighbours.has(node.id))
          if (node.data.dimmed === dimmed) return node
          return { ...node, data: { ...node.data, dimmed } }
        })
      )
    },
    [neighboursByNode, setFlowNodes]
  )

  const persistNodePosition = useCallback((node: ResourceFlowNode) => {
    setLayoutPositions((current) => {
      const previous = current.get(node.id)
      if (!previous) return current
      const next = new Map(current)
      next.set(node.id, { ...previous, ...node.position })
      displayedPositions.current = next
      return next
    })
  }, [])

  const cancelLayoutForDrag = useCallback(() => {
    layoutGeneration.current += 1
    cancelAnimationFrameRef(layoutAnimationFrame)
    cancelAnimationFrameRef(entryRevealFrame)
    setEnteringNodeIds(new Set())
    setEnteringEdgeIds(new Set())
    setLayoutPending(false)
  }, [])

  const handleInit = useCallback(() => setFlowReady(true), [])
  const handleNodeClick = useCallback<NodeMouseHandler<ResourceFlowNode>>(
    (event, node) => {
      if (node.id === graph.rootMfid) return
      if (event.currentTarget instanceof HTMLElement) {
        onInspect(node.id, event.currentTarget)
      }
    },
    [graph.rootMfid, onInspect]
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
        if (
          !edgeMetrics ||
          !layoutPositions.has(edge.source) ||
          !layoutPositions.has(edge.target)
        ) {
          return []
        }
        const highlighted = Boolean(
          hoveredNode &&
          (edge.source === hoveredNode || edge.target === hoveredNode)
        )
        const dimmed = Boolean(hoveredNode && !highlighted)
        const edgeColor = highlighted
          ? "var(--graph-highlight)"
          : "var(--graph-edge)"
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
                    type: MarkerType.Arrow,
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
            sourceHandle:
              edge.relationship === "associated"
                ? "association-source"
                : "lineage-source",
            target: edge.target,
            targetHandle:
              edge.relationship === "associated"
                ? "association-target"
                : "lineage-target",
            type: edge.relationship === "associated" ? "default" : "smoothstep",
          },
        ]
      }),
    [edgeMetrics, enteringEdgeIds, graph.edges, hoveredNode, layoutPositions]
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
        onInit={handleInit}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onNodesChange={handleNodesChange}
        onNodeClick={handleNodeClick}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        onlyRenderVisibleElements={
          graph.nodes.length >= GRAPH_VIEWPORT_CULLING_NODE_THRESHOLD
        }
        panOnScroll
        preventScrolling={false}
        proOptions={reactFlowProOptions}
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
        repositioned by dragging, and Reset layout restores the ELK arrangement.
        The relationship table following the graph provides the same resources
        with keyboard-accessible inspection and navigation.
      </span>
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
          <LoadingMoreIcon aria-hidden="true" className="animate-spin" />
          {loading ? "Loading" : "Arranging"}
        </div>
      ) : null}
      <ResourceGraphLegend />
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
        id="association-source"
        position={Position.Bottom}
        type="source"
      />
      <Handle
        className="resource-graph-handle resource-graph-handle-association-target"
        id="association-target"
        position={Position.Bottom}
        type="target"
      />
      <div className="resource-graph-flow-node-content">
        {data.thumbnail ? (
          <DatasetThumbnailImage
            alt=""
            className="resource-graph-flow-node-thumbnail"
            decoding="async"
            loading="lazy"
            thumbnail={data.thumbnail}
          />
        ) : null}
        <div className="resource-graph-flow-node-identity">
          <ResourceTypeIcon
            className="resource-graph-flow-node-icon"
            type={data.node.kind}
          />
          <div className="resource-graph-flow-node-copy">
            <span className="resource-graph-flow-node-name">
              {data.node.name}
            </span>
            {data.context ? (
              <span className="resource-graph-flow-node-context">
                {data.context}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {expansionModes.length > 0 ? (
        <GraphNodeExpansionControls
          modes={expansionModes}
          expansionStates={data.expansionStates}
          layoutDirection={data.layoutDirection}
          node={data.node}
          onExpand={data.onExpand}
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
}: {
  modes: readonly GraphExpansionMode[]
  expansionStates: ReadonlyMap<string, GraphExpansionState>
  layoutDirection: LayoutDirection
  node: WorkspaceResourceGraphNode
  onExpand: (nodeMfid: string, mode: GraphExpansionMode) => void
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
  state,
}: {
  mode: GraphExpansionMode
  layoutDirection: LayoutDirection
  node: WorkspaceResourceGraphNode
  onExpand: (nodeMfid: string, mode: GraphExpansionMode) => void
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
        {pending ? (
          <LoadingMoreIcon
            aria-hidden="true"
            className="animate-spin"
            data-icon="inline-start"
          />
        ) : (
          <Icon aria-hidden="true" data-icon="inline-start" />
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
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
  return (
    <div className="resource-graph-controls absolute top-3 right-3 flex gap-2">
      <ButtonGroup aria-label="Graph viewport controls">
        <GraphControl
          label="Zoom graph out"
          onClick={() =>
            void flow.zoomOut(graphViewportOptions(surface.current))
          }
        >
          <ZoomOutGraphIcon aria-hidden="true" />
        </GraphControl>
        <GraphControl
          label="Zoom graph in"
          onClick={() =>
            void flow.zoomIn(graphViewportOptions(surface.current))
          }
        >
          <ZoomInGraphIcon aria-hidden="true" />
        </GraphControl>
        <GraphControl
          label="Fit all resources"
          onClick={() =>
            void flow.fitView({
              ...graphViewportOptions(surface.current),
              padding: 0.16,
            })
          }
        >
          <FitGraphIcon aria-hidden="true" />
        </GraphControl>
      </ButtonGroup>
      <GraphDisplayMenu
        display={display}
        flow={flow}
        graph={graph}
        onDisplayChange={onDisplayChange}
        onResetLayout={onResetLayout}
        positions={positions}
        surface={surface}
      />
      <GraphControl
        label={fullscreen ? "Exit fullscreen graph" : "View graph fullscreen"}
        onClick={onToggleFullscreen}
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
  positions,
  surface,
}: {
  display: ResourceGraphDisplay
  flow: ReactFlowInstance<ResourceFlowNode, ResourceFlowEdge>
  graph: WorkspaceResourceGraph
  onDisplayChange: (changes: Partial<ResourceGraphDisplay>) => void
  onResetLayout: () => void
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
        <TooltipContent>Graph options</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Layout</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => {
              const element = surface.current
              if (element) {
                centerResourceGraph(flow, element, graph.rootMfid, positions)
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
  pressed,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
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
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function ResourceGraphLegend() {
  return (
    <div
      aria-label="Graph legend"
      className="resource-graph-legend absolute bottom-3 left-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-supporting text-muted-foreground"
    >
      <span className="flex items-center gap-1.5">
        <ResourceTypeIcon type="sample" /> Sample
      </span>
      <span className="flex items-center gap-1.5">
        <ResourceTypeIcon type="dataset" /> Dataset
      </span>
    </div>
  )
}

async function layoutResourceGraph(
  graph: WorkspaceResourceGraph,
  element: HTMLElement,
  direction: LayoutDirection
) {
  const nodeWidth = graphNumberToken(element, "--graph-node-width")
  const nodeHeight = graphNumberToken(element, "--graph-node-height")
  const rootWidth = graphNumberToken(element, "--graph-root-node-width")
  const rootHeight = graphNumberToken(element, "--graph-root-node-height")
  const layout = await resourceGraphLayoutEngine().layout({
    children: graph.nodes.map((node) => ({
      height: node.unique_id === graph.rootMfid ? rootHeight : nodeHeight,
      id: node.unique_id,
      width: node.unique_id === graph.rootMfid ? rootWidth : nodeWidth,
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
    id: "resource-graph",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": direction,
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.nodePlacement.favorStraightEdges": "true",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.layered.spacing.nodeNodeBetweenLayers": String(
        graphNumberToken(element, "--graph-layout-layer-gap")
      ),
      "elk.spacing.nodeNode": String(
        graphNumberToken(element, "--graph-layout-node-gap")
      ),
    },
  })
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
}

function fallbackResourceGraphLayout(
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
  positions: ReadonlyMap<string, LayoutPosition>
) {
  const root = positions.get(rootMfid)
  if (!root) return
  const rootCenter = {
    x: root.x + root.width / 2,
    y: root.y + root.height / 2,
  }
  const extents = [...positions.values()].reduce(
    (current, position) => ({
      x: Math.max(
        current.x,
        Math.abs(position.x - rootCenter.x),
        Math.abs(position.x + position.width - rootCenter.x)
      ),
      y: Math.max(
        current.y,
        Math.abs(position.y - rootCenter.y),
        Math.abs(position.y + position.height - rootCenter.y)
      ),
    }),
    { x: root.width / 2, y: root.height / 2 }
  )
  const padding = graphNumberToken(element, "--graph-fit-padding")
  const zoom = Math.min(
    Math.max(element.clientWidth - padding * 2, 1) / Math.max(extents.x * 2, 1),
    Math.max(element.clientHeight - padding * 2, 1) /
      Math.max(extents.y * 2, 1),
    graphNumberToken(element, "--graph-max-zoom")
  )
  void flow.setCenter(rootCenter.x, rootCenter.y, {
    ...graphViewportOptions(element),
    zoom: Math.max(
      zoom,
      graphNumberToken(element, "--graph-readable-zoom"),
      graphNumberToken(element, "--graph-min-zoom")
    ),
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
  setEnteringNodeIds: (value: ReadonlySet<string>) => void,
  setEnteringEdgeIds: (value: ReadonlySet<string>) => void
) {
  frame.current = requestAnimationFrame(() => {
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      if (currentGeneration.current !== generation) return
      setEnteringNodeIds(new Set())
      setEnteringEdgeIds(new Set())
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
