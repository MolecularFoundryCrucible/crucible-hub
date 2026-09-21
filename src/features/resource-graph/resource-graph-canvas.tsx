import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
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
  GraphAssociationsIcon,
  GraphDescendantsIcon,
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
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
  const lastPositions = useRef(new Map<string, LayoutPosition>())
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
      setLayoutDirection(resolveLayoutDirection(element, display.orientation))
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
    const previousRoot = resetLayout
      ? undefined
      : lastPositions.current.get(currentGraph.rootMfid)
    const previousViewport = flow.getViewport()
    const previousRootScreen = previousRoot
      ? {
          x:
            (previousRoot.x + previousRoot.width / 2) * previousViewport.zoom +
            previousViewport.x,
          y:
            (previousRoot.y + previousRoot.height / 2) * previousViewport.zoom +
            previousViewport.y,
        }
      : null
    setLayoutPending(true)
    void layoutResourceGraph(currentGraph, element, layoutDirection).then(
      (nextPositions) => {
        if (layoutGeneration.current !== generation) return
        lastPositions.current = nextPositions
        setLayoutPositions(nextPositions)
        const nextRoot = nextPositions.get(currentGraph.rootMfid)
        if (nextRoot && previousRootScreen) {
          void flow.setViewport(
            {
              x:
                previousRootScreen.x -
                (nextRoot.x + nextRoot.width / 2) * previousViewport.zoom,
              y:
                previousRootScreen.y -
                (nextRoot.y + nextRoot.height / 2) * previousViewport.zoom,
              zoom: previousViewport.zoom,
            },
            graphViewportOptions(element)
          )
        } else {
          centerResourceGraph(
            flow,
            element,
            currentGraph.rootMfid,
            nextPositions
          )
        }
        setLayoutPending(false)
      },
      () => {
        if (layoutGeneration.current !== generation) return
        const fallbackPositions = fallbackResourceGraphLayout(
          currentGraph,
          element,
          layoutDirection
        )
        lastPositions.current = fallbackPositions
        setLayoutPositions(fallbackPositions)
        centerResourceGraph(
          flow,
          element,
          currentGraph.rootMfid,
          fallbackPositions
        )
        setLayoutPending(false)
      }
    )
  }, [flow, flowReady, layoutDirection, layoutRevision, layoutSignature])

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
              expansionStates,
              expansionModes: expansionModesByNode.get(node.unique_id) ?? [],
              isRoot: node.unique_id === graph.rootMfid,
              layoutDirection: layoutDirection ?? "RIGHT",
              node,
              onExpand,
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
      layoutDirection,
      layoutPositions,
      onExpand,
      rootContext,
      thumbnails,
    ]
  )
  const [flowNodes, setFlowNodes, handleNodesChange] =
    useNodesState<ResourceFlowNode>(calculatedNodes)

  useEffect(() => {
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
      lastPositions.current = next
      return next
    })
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
        return [
          {
            animated: false,
            className: [
              `resource-graph-edge-${edge.relationship}`,
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
                    color: "var(--graph-edge)",
                    height: 14,
                    type: MarkerType.ArrowClosed,
                    width: 14,
                  }
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
    [graph.edges, hoveredNode, layoutPositions]
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
        from left to right on wider screens and top to bottom on compact
        screens. Dashed edges show sample and dataset associations. Expansion
        controls load ancestors, descendants, or associated resources. Nodes can
        be repositioned by dragging, and Reset layout restores the ELK
        arrangement. The relationship table following the graph provides the
        same resources with keyboard-accessible inspection and navigation.
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
      data-kind={data.node.kind}
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
      {data.thumbnail ? (
        <DatasetThumbnailImage
          alt=""
          className="resource-graph-flow-node-thumbnail"
          decoding="async"
          loading="lazy"
          thumbnail={data.thumbnail}
        />
      ) : null}
      <span className="resource-graph-flow-node-name">
        <ResourceTypeIcon className="size-5 shrink-0" type={data.node.kind} />
        <span>{data.node.name}</span>
      </span>
      {data.context ? (
        <span className="resource-graph-flow-node-context">{data.context}</span>
      ) : null}
      {expansionModes.length > 0 ? (
        <GraphNodeExpansionControls
          modes={expansionModes}
          expansionStates={data.expansionStates}
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
  node,
  onExpand,
}: {
  modes: readonly GraphExpansionMode[]
  expansionStates: ReadonlyMap<string, GraphExpansionState>
  node: WorkspaceResourceGraphNode
  onExpand: (nodeMfid: string, mode: GraphExpansionMode) => void
}) {
  return (
    <>
      {modes.map((mode) => (
        <GraphNodeExpansionAction
          key={mode}
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
  node,
  onExpand,
  state,
}: {
  mode: GraphExpansionMode
  node: WorkspaceResourceGraphNode
  onExpand: (nodeMfid: string, mode: GraphExpansionMode) => void
  state?: GraphExpansionState
}) {
  const pending = graphExpansionPending(state)
  const Icon = graphExpansionIcon(mode)
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
            className={`nodrag nopan resource-graph-expansion-action resource-graph-expansion-${mode} rounded-full shadow-sm`}
            disabled={pending}
            onClick={(event) => {
              event.stopPropagation()
              onExpand(node.unique_id, mode)
            }}
            size="icon-sm"
            type="button"
            variant={state?.isError ? "destructive" : "outline"}
          />
        }
      >
        {pending ? (
          <LoadingMoreIcon aria-hidden="true" className="animate-spin" />
        ) : (
          <Icon aria-hidden="true" />
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function graphExpansionIcon(mode: GraphExpansionMode) {
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
    <div className="resource-graph-controls absolute top-3 right-3 flex gap-1">
      <GraphControl
        label="Zoom graph out"
        onClick={() => void flow.zoomOut(graphViewportOptions(surface.current))}
      >
        <ZoomOutGraphIcon aria-hidden="true" />
      </GraphControl>
      <GraphControl
        label="Zoom graph in"
        onClick={() => void flow.zoomIn(graphViewportOptions(surface.current))}
      >
        <ZoomInGraphIcon aria-hidden="true" />
      </GraphControl>
      <GraphControl
        label="Center current resource"
        onClick={() => {
          const element = surface.current
          if (element) {
            centerResourceGraph(flow, element, graph.rootMfid, positions)
          }
        }}
      >
        <ExploreGraphFocusIcon aria-hidden="true" />
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
      <GraphControl label="Reset graph layout" onClick={onResetLayout}>
        <ResetGraphLayoutIcon aria-hidden="true" />
      </GraphControl>
      <GraphDisplayMenu display={display} onDisplayChange={onDisplayChange} />
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
  onDisplayChange,
}: {
  display: ResourceGraphDisplay
  onDisplayChange: (changes: Partial<ResourceGraphDisplay>) => void
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label="Graph display options"
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
        <TooltipContent>Graph display options</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="min-w-44">
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
            if (
              value === "auto" ||
              value === "horizontal" ||
              value === "vertical"
            ) {
              onDisplayChange({ orientation: value })
            }
          }}
          value={display.orientation}
        >
          <DropdownMenuLabel>Orientation</DropdownMenuLabel>
          <DropdownMenuRadioItem value="auto">Auto</DropdownMenuRadioItem>
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

function graphStringToken(element: HTMLElement, name: string) {
  const value = getComputedStyle(element).getPropertyValue(name).trim()
  if (!value) throw new Error(`Invalid graph token: ${name}`)
  return value
}

function resolveLayoutDirection(
  element: HTMLElement,
  orientation: GraphOrientation
): LayoutDirection {
  if (orientation === "horizontal") return "RIGHT"
  if (orientation === "vertical") return "DOWN"
  return graphStringToken(element, "--graph-layout-direction") === "DOWN"
    ? "DOWN"
    : "RIGHT"
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
