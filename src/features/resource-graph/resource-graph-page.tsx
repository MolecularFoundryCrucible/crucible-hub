import { useEffect, useMemo, useRef, useState } from "react"
import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query"
import cytoscape from "cytoscape"
import type { Core, ElementDefinition, StylesheetJson } from "cytoscape"
import { z } from "zod"

import {
  ExploreGraphFocusIcon,
  ExpandGraphNodeIcon,
  FitGraphIcon,
  GraphAncestorsIcon,
  GraphAssociationsIcon,
  GraphDescendantsIcon,
  LoadingMoreIcon,
  ResourceGraphIcon,
  ZoomInGraphIcon,
  ZoomOutGraphIcon,
} from "@/components/crucible/icons"
import { DatasetThumbnailImage } from "@/components/crucible/dataset-thumbnail"
import { ResourceFullPageLink } from "@/components/crucible/resource-full-page-link"
import {
  ResourcePreviewLink,
  useResourcePreviewContext,
} from "@/components/crucible/resource-preview-navigation"
import {
  staticResourceSiblingCollection,
  useRegisterResourceSiblings,
} from "@/components/crucible/resource-sibling-navigation"
import {
  ResourceTypeIcon,
  resourceTypeGraphIconDataUri,
} from "@/components/crucible/resource-type-icon"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { THUMBNAIL_PREVIEW_BATCH_MAX } from "@/data/crucible/resources.functions"
import {
  datasetThumbnailPreviewsQueryOptions,
  resourceGraphQueryOptions,
} from "@/data/crucible/resources.queries"
import { HubApiClientError } from "@/data/crucible/result"
import { workspaceRelationshipTypeLabel } from "@/data/crucible/resource-relationships"
import type {
  WorkspaceDatasetThumbnail,
  WorkspaceResourceGraph,
  WorkspaceResourceGraphNode,
} from "@/data/crucible/workspace-source"
import { mergeResourceGraphs } from "./resource-graph-merge"
import { useResourceWorkspaceResource } from "@/features/resource-detail/resource-detail-page"

let elkRegistration: Promise<void> | undefined

function ensureElkRegistered() {
  elkRegistration ??= import("cytoscape-elk").then(({ default: register }) => {
    cytoscape.use(register)
  })
  return elkRegistration
}

type GraphLabelMetrics = {
  maxWidth: number
  measure: (value: string) => number
}

type GraphExpansionQueryResult = {
  data?: WorkspaceResourceGraph
  isError: boolean
  isFetching: boolean
  isPending: boolean
  isSuccess: boolean
  refetch: () => Promise<unknown>
}

type GraphExpansionState = Pick<
  GraphExpansionQueryResult,
  "isError" | "isFetching" | "isPending" | "isSuccess" | "refetch"
>

type GraphExpansionMode = "ancestors" | "associations" | "descendants"

type GraphExpansionRequest = {
  mode: GraphExpansionMode
  nodeMfid: string
}

const graphExpansionModes: readonly GraphExpansionMode[] = [
  "ancestors",
  "descendants",
  "associations",
]

export const resourceGraphSearchSchema = z.object({
  depth: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .optional()
    .catch(undefined),
})

export type ResourceGraphDepth = 1 | 2 | 3

function combineResourceGraphExpansionQueries(
  results: readonly GraphExpansionQueryResult[]
) {
  return {
    graphs: results.flatMap((result) => (result.data ? [result.data] : [])),
    isFetching: results.some((result) => result.isFetching),
    states: results.map((result) => ({
      isError: result.isError,
      isFetching: result.isFetching,
      isPending: result.isPending,
      isSuccess: result.isSuccess,
      refetch: result.refetch,
    })),
  }
}

function graphExpansionKey(nodeMfid: string, mode: GraphExpansionMode) {
  return `${nodeMfid}:${mode}`
}

function graphExpansionQuery(mode: GraphExpansionMode) {
  if (mode === "ancestors") {
    return {
      depth: 1,
      direction: "upstream" as const,
      relationshipKinds: ["lineage" as const],
    }
  }
  if (mode === "descendants") {
    return {
      depth: 1,
      direction: "downstream" as const,
      relationshipKinds: ["lineage" as const],
    }
  }
  return {
    depth: 1,
    direction: "both" as const,
    relationshipKinds: ["association" as const],
  }
}

function graphExpansionModeLabel(mode: GraphExpansionMode) {
  if (mode === "ancestors") return "Ancestors"
  if (mode === "descendants") return "Descendants"
  return "Associated"
}

function graphExpansionState(
  states: ReadonlyMap<string, GraphExpansionState>,
  nodeMfid: string,
  mode: GraphExpansionMode
) {
  return states.get(graphExpansionKey(nodeMfid, mode))
}

function graphExpansionPending(state?: GraphExpansionState) {
  return Boolean(state?.isPending || state?.isFetching)
}

function graphNodeCanExpand(
  node: WorkspaceResourceGraphNode,
  states: ReadonlyMap<string, GraphExpansionState>
) {
  const modeStates = graphExpansionModes.map((mode) =>
    graphExpansionState(states, node.unique_id, mode)
  )
  if (modeStates.some((state) => state && !state.isSuccess)) return true
  if (modeStates.some(Boolean)) return modeStates.some((state) => !state)
  return node.hasMoreRelationships !== false
}

export function ResourceGraphPage({
  depth,
  onDepthChange,
  resourceKind,
  resourceMfid,
}: {
  depth: ResourceGraphDepth
  onDepthChange: (depth: ResourceGraphDepth) => void
  resourceKind: "dataset" | "sample"
  resourceMfid: string
}) {
  const scope = useWorkspaceScope()
  const navigation = useResourcePreviewContext()
  const resource = useResourceWorkspaceResource()
  const graph = useRef<Core | null>(null)
  const [expansion, setExpansion] = useState({
    depth,
    resourceMfid,
    requests: [] as GraphExpansionRequest[],
  })
  const expansionRequests =
    expansion.resourceMfid === resourceMfid && expansion.depth === depth
      ? expansion.requests
      : []
  const query = useQuery({
    ...resourceGraphQueryOptions(scope, resourceMfid, {
      depth,
      relationshipKinds: depth === 1 ? undefined : ["lineage"],
    }),
    placeholderData: keepPreviousData,
  })
  const associationQuery = useQuery({
    ...resourceGraphQueryOptions(scope, resourceMfid, {
      depth: 1,
      relationshipKinds: ["association"],
    }),
    enabled: depth > 1,
  })
  const expansions = useQueries({
    queries: expansionRequests.map((request) =>
      resourceGraphQueryOptions(
        scope,
        request.nodeMfid,
        graphExpansionQuery(request.mode)
      )
    ),
    combine: combineResourceGraphExpansionQueries,
  })
  const rootGraph = useMemo(() => {
    if (!query.data) return undefined
    if (depth === 1 || query.isPlaceholderData || !associationQuery.data) {
      return query.data
    }
    return mergeResourceGraphs(query.data, [associationQuery.data])
  }, [associationQuery.data, depth, query.data, query.isPlaceholderData])
  const displayedGraph = useMemo(() => {
    if (!rootGraph) return undefined
    return mergeResourceGraphs(rootGraph, expansions.graphs)
  }, [expansions.graphs, rootGraph])
  const expansionStates = new Map<string, GraphExpansionState>(
    expansionRequests.map((request, index) => [
      graphExpansionKey(request.nodeMfid, request.mode),
      expansions.states[index],
    ])
  )
  const datasetMfids = displayedGraph
    ? displayedGraph.nodes
        .filter(
          (node) =>
            node.kind === "dataset" &&
            node.unique_id !== displayedGraph.rootMfid
        )
        .slice(0, THUMBNAIL_PREVIEW_BATCH_MAX)
        .map((node) => node.unique_id)
    : []
  const thumbnailQuery = useQuery({
    ...datasetThumbnailPreviewsQueryOptions(scope, datasetMfids),
    enabled: Boolean(displayedGraph) && datasetMfids.length > 0,
  })
  const previewSiblingCollections = useMemo(() => {
    const graphData = displayedGraph
    const items = graphData
      ? graphData.nodes
          .filter((node) => node.unique_id !== graphData.rootMfid)
          .map((node) => ({
            kind: node.kind,
            mfid: node.unique_id,
            name: node.name,
          }))
      : []
    return items.length
      ? [staticResourceSiblingCollection(items, "Graph relationships")]
      : []
  }, [displayedGraph])
  useRegisterResourceSiblings(previewSiblingCollections)

  if (query.isPending || (depth > 1 && associationQuery.isPending)) {
    return <ResourceGraphPending />
  }
  if (!displayedGraph) {
    return (
      <Empty className="min-h-graph-canvas border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ResourceGraphIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Graph unavailable</EmptyTitle>
          <EmptyDescription>{graphErrorMessage(query.error)}</EmptyDescription>
        </EmptyHeader>
        <Button
          onClick={() => void query.refetch()}
          size="sm"
          type="button"
          variant="outline"
        >
          Try again
        </Button>
      </Empty>
    )
  }

  const relatedNodes = displayedGraph.nodes.filter(
    (node) => node.unique_id !== displayedGraph.rootMfid
  )
  const isExpanding = expansions.isFetching
  const expandNode = (nodeMfid: string, mode: GraphExpansionMode) => {
    const state = expansionStates.get(graphExpansionKey(nodeMfid, mode))
    if (state?.isError) {
      void state.refetch()
      return
    }
    setExpansion((current) => {
      const requests =
        current.resourceMfid === resourceMfid && current.depth === depth
          ? current.requests
          : []
      if (
        requests.some(
          (request) => request.nodeMfid === nodeMfid && request.mode === mode
        )
      ) {
        return current
      }
      return {
        depth,
        resourceMfid,
        requests: [...requests, { mode, nodeMfid }],
      }
    })
  }

  return (
    <section
      aria-busy={query.isFetching || associationQuery.isFetching || isExpanding}
      aria-label="Resource graph"
      className="flex min-w-0 flex-col gap-4"
    >
      {query.isError ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3"
          role="alert"
        >
          <p className="text-body text-muted-foreground">
            The graph could not be refreshed. Showing the last available data.
          </p>
          <Button
            onClick={() => void query.refetch()}
            size="sm"
            type="button"
            variant="outline"
          >
            Try again
          </Button>
        </div>
      ) : null}

      {depth > 1 && associationQuery.isError ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3"
          role="alert"
        >
          <p className="text-body text-muted-foreground">
            Immediate associations could not be loaded. Lineage remains
            available.
          </p>
          <Button
            onClick={() => void associationQuery.refetch()}
            size="sm"
            type="button"
            variant="outline"
          >
            Try again
          </Button>
        </div>
      ) : null}

      {displayedGraph.truncated ? (
        <div className="flex flex-wrap items-center gap-2" role="status">
          <Badge variant="warning">Limited graph</Badge>
          <p className="text-body text-muted-foreground">
            The server limit omitted some readable relationships.
          </p>
        </div>
      ) : null}

      {relatedNodes.length === 0 ? (
        <Empty className="min-h-graph-canvas border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ResourceTypeIcon type={resourceKind} />
            </EmptyMedia>
            <EmptyTitle>No immediate relationships</EmptyTitle>
            <EmptyDescription>
              This resource is not connected to another readable sample or
              dataset.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ResourceGraphCanvas
          depth={depth}
          expansionStates={expansionStates}
          graph={displayedGraph}
          instanceRef={graph}
          loading={
            query.isFetching || associationQuery.isFetching || isExpanding
          }
          nodes={relatedNodes}
          onDepthChange={onDepthChange}
          onExpand={expandNode}
          rootContext={
            resource.kind === "sample"
              ? resource.sample_type
              : resource.measurement
          }
          onInspect={(mfid, trigger) => {
            const node = relatedNodes.find(
              (candidate) => candidate.unique_id === mfid
            )
            navigation.open(
              mfid,
              trigger,
              node ? { kind: node.kind, mfid, name: node.name } : undefined
            )
          }}
        />
      )}

      {thumbnailQuery.isError ? (
        <p className="text-body text-muted-foreground" role="alert">
          Thumbnail previews could not be loaded. The graph remains available.
        </p>
      ) : null}

      {expansions.states.some((state) => state.isError) ? (
        <p className="text-body text-destructive" role="alert">
          The graph could not be expanded. Use the retry action beside the
          affected resource.
        </p>
      ) : null}

      <ResourceGraphTable
        expansionStates={expansionStates}
        graph={displayedGraph}
        nodes={relatedNodes}
        onExpand={expandNode}
        thumbnails={thumbnailQuery.data ?? {}}
      />
    </section>
  )
}

function ResourceGraphPending() {
  return (
    <div aria-label="Loading resource graph" role="status">
      <Skeleton className="min-h-graph-canvas w-full" />
    </div>
  )
}

function ResourceGraphCanvas({
  depth,
  expansionStates,
  graph,
  instanceRef,
  loading,
  nodes,
  onDepthChange,
  onExpand,
  onInspect,
  rootContext,
}: {
  depth: ResourceGraphDepth
  expansionStates: ReadonlyMap<string, GraphExpansionState>
  graph: WorkspaceResourceGraph
  instanceRef: React.MutableRefObject<Core | null>
  loading: boolean
  nodes: readonly WorkspaceResourceGraphNode[]
  onDepthChange: (depth: ResourceGraphDepth) => void
  onExpand: (nodeMfid: string, mode: GraphExpansionMode) => void
  onInspect: (mfid: string, trigger: HTMLElement) => void
  rootContext: string | null
}) {
  const container = useRef<HTMLDivElement>(null)
  const expand = useRef(onExpand)
  const inspect = useRef(onInspect)
  const rootMfid = useRef(graph.rootMfid)
  const layoutGeneration = useRef(0)
  const [activeExpansionNode, setActiveExpansionNode] = useState<string | null>(
    null
  )
  const [layoutEngine, setLayoutEngine] = useState<
    "loading" | "elk" | "fallback"
  >("loading")
  const [layoutPending, setLayoutPending] = useState(true)
  expand.current = onExpand
  inspect.current = onInspect
  rootMfid.current = graph.rootMfid

  useEffect(() => {
    let active = true
    void ensureElkRegistered().then(
      () => {
        if (active) setLayoutEngine("elk")
      },
      () => {
        if (active) setLayoutEngine("fallback")
      }
    )
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const element = container.current
    if (!element) return
    const instance = cytoscape({
      boxSelectionEnabled: false,
      container: element,
      elements: [],
      layout: {
        animate: false,
        fit: false,
        name: "preset",
      },
      maxZoom: graphNumberToken(element, "--graph-max-zoom"),
      minZoom: graphNumberToken(element, "--graph-min-zoom"),
      style: graphStyles(element),
    })
    instanceRef.current = instance
    instance.scratch("resourceGraphViewportChanged", false)
    instance.on("tap", "node[?graphAction]", (event) => {
      const nodeMfid = event.target.data("actionTarget")
      const mode = event.target.data("expansionMode")
      if (typeof nodeMfid !== "string") return
      if (isGraphExpansionMode(mode)) {
        expand.current(nodeMfid, mode)
        return
      }
      setActiveExpansionNode((current) =>
        current === nodeMfid ? null : nodeMfid
      )
    })
    instance.on("tap", "node[!graphAction]", (event) => {
      const mfid = event.target.data("id")
      if (typeof mfid === "string" && mfid !== rootMfid.current) {
        inspect.current(mfid, element)
      }
    })
    instance.on("tap", (event) => {
      if (event.target === instance) setActiveExpansionNode(null)
    })
    instance.on("mouseover", "node[!graphAction]", (event) => {
      element.dataset.nodeHover = ""
      const focus = event.target.closedNeighborhood()
      instance.elements("node[!graphAction], edge").addClass("graph-muted")
      focus.removeClass("graph-muted")
      event.target.addClass("graph-hovered")
      focus.edges().addClass("graph-highlighted")
    })
    instance.on("mouseout", "node[!graphAction]", (event) => {
      delete element.dataset.nodeHover
      event.target.removeClass("graph-hovered")
      instance.elements().removeClass("graph-muted graph-highlighted")
    })
    instance.on("mouseover", "node[?graphAction]", () => {
      element.dataset.nodeAction = ""
    })
    instance.on("mouseout", "node[?graphAction]", () => {
      delete element.dataset.nodeAction
    })
    instance.on("dragpan scrollzoom pinchzoom", () => {
      instance.scratch("resourceGraphViewportChanged", true)
    })
    const resizeObserver = new ResizeObserver(() => {
      instance.resize()
      if (!instance.scratch("resourceGraphViewportChanged")) {
        centerCurrentResource(instance)
      }
    })
    resizeObserver.observe(element)
    const themeObserver = new MutationObserver(() => {
      instance.style(graphStyles(element))
    })
    themeObserver.observe(document.documentElement, {
      attributeFilter: ["class"],
      attributes: true,
    })
    return () => {
      resizeObserver.disconnect()
      themeObserver.disconnect()
      if (instance.scratch("resourceGraphLayoutPending")) {
        instance.one("layoutstop", () => instance.destroy())
      } else {
        instance.destroy()
      }
      if (instanceRef.current === instance) instanceRef.current = null
    }
  }, [instanceRef])

  useEffect(() => {
    const element = container.current
    const instance = instanceRef.current
    if (!element || !instance || layoutEngine === "loading") return
    const generation = layoutGeneration.current + 1
    layoutGeneration.current = generation
    const labelMetrics = graphLabelMetrics(element)
    const definitions = graphElements(graph, rootContext, labelMetrics)
    const previousRoot = instance.$id(graph.rootMfid)
    const previousRootPosition = previousRoot.length
      ? previousRoot.renderedPosition()
      : undefined
    const previousNodeIds = new Set(instance.nodes().map((node) => node.id()))
    updateGraphElements(instance, definitions, graph)
    instance.style(graphStyles(element))
    const animate =
      previousNodeIds.size > 0 &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    setLayoutPending(true)
    let layout: ReturnType<Core["layout"]> | undefined
    const handleLayoutStop = () => {
      instance.scratch("resourceGraphLayoutPending", false)
      if (layoutGeneration.current !== generation || instance.destroyed())
        return
      if (previousRootPosition) {
        const nextRoot = instance.$id(graph.rootMfid)
        if (nextRoot.length) {
          const nextPosition = nextRoot.renderedPosition()
          instance.panBy({
            x: previousRootPosition.x - nextPosition.x,
            y: previousRootPosition.y - nextPosition.y,
          })
        }
      } else {
        centerCurrentResource(instance)
      }
      setLayoutPending(false)
    }
    instance.one("layoutstop", handleLayoutStop)
    const startFrame = requestAnimationFrame(() => {
      if (instance.destroyed()) return
      instance.scratch("resourceGraphLayoutPending", true)
      layout = instance.layout(
        layoutEngine === "elk"
          ? graphElkLayout(element, animate)
          : graphFallbackLayout(element)
      )
      layout.run()
    })
    return () => {
      cancelAnimationFrame(startFrame)
      instance.off("layoutstop", handleLayoutStop)
      layout?.stop()
    }
  }, [graph, instanceRef, layoutEngine, rootContext])

  const expansionSignature = nodes
    .map((node) => {
      const states = graphExpansionModes.map((mode) => {
        const state = graphExpansionState(expansionStates, node.unique_id, mode)
        return state?.isPending || state?.isFetching
          ? "pending"
          : state?.isError
            ? "error"
            : state?.isSuccess
              ? "complete"
              : "available"
      })
      return `${node.unique_id}:${node.hasMoreRelationships}:${states.join(",")}`
    })
    .join("|")

  useEffect(() => {
    const instance = instanceRef.current
    if (!instance || layoutPending) return
    syncGraphExpansionControls(
      instance,
      nodes,
      expansionStates,
      activeExpansionNode
    )
  }, [
    activeExpansionNode,
    expansionSignature,
    expansionStates,
    instanceRef,
    layoutEngine,
    layoutPending,
    nodes,
  ])

  return (
    <div
      className="resource-graph-surface relative overflow-hidden rounded-xl border bg-card"
      data-density={graphDensity(graph.nodes.length)}
    >
      <div className="resource-graph-options absolute top-3 left-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-label">
          <span>Depth</span>
          <NativeSelect
            aria-label="Graph depth"
            onChange={(event) => {
              const nextDepth = Number(event.currentTarget.value)
              if (nextDepth === 1 || nextDepth === 2 || nextDepth === 3) {
                onDepthChange(nextDepth)
              }
            }}
            size="sm"
            value={depth}
          >
            <NativeSelectOption value={1}>1</NativeSelectOption>
            <NativeSelectOption value={2}>2</NativeSelectOption>
            <NativeSelectOption value={3}>3</NativeSelectOption>
          </NativeSelect>
        </label>
        <GraphExpansionMenu
          expansionStates={expansionStates}
          nodes={nodes}
          onExpand={onExpand}
        />
      </div>
      <div className="resource-graph-controls absolute top-3 right-3 flex gap-1">
        <GraphControl
          label="Zoom graph out"
          onClick={() => zoomGraph(instanceRef.current, 1 / 1.25)}
        >
          <ZoomOutGraphIcon aria-hidden="true" />
        </GraphControl>
        <GraphControl
          label="Zoom graph in"
          onClick={() => zoomGraph(instanceRef.current, 1.25)}
        >
          <ZoomInGraphIcon aria-hidden="true" />
        </GraphControl>
        <GraphControl
          label="Center current resource"
          onClick={() => {
            const instance = instanceRef.current
            if (instance) centerCurrentResource(instance)
          }}
        >
          <ExploreGraphFocusIcon aria-hidden="true" />
        </GraphControl>
        <GraphControl
          label="Fit all resources"
          onClick={() => {
            const instance = instanceRef.current
            if (!instance) return
            const element = instance.container()
            if (!element) return
            instance.scratch("resourceGraphViewportChanged", true)
            instance.fit(
              graphContentElements(instance),
              graphNumberToken(element, "--graph-fit-padding")
            )
          }}
        >
          <FitGraphIcon aria-hidden="true" />
        </GraphControl>
      </div>
      <div
        aria-describedby="resource-graph-instructions"
        aria-label={`Graph of ${graph.nodes.length} resources and ${graph.edges.length} relationships`}
        className="resource-graph-canvas"
        data-resource-preview-trigger=""
        ref={container}
        role="img"
        tabIndex={-1}
      >
        <span className="sr-only" id="resource-graph-instructions">
          The current resource is centered. Lineage flows from parent to child
          from left to right on wider screens and top to bottom on compact
          screens. Dashed edges show sample and dataset associations. Expand
          controls load immediate relationships from a connected resource. The
          relationship table following the graph provides the same resources
          with keyboard-accessible inspection and navigation.
        </span>
      </div>
      {loading || layoutPending || layoutEngine === "fallback" ? (
        <div
          className="resource-graph-layout-status absolute right-3 bottom-3 flex items-center gap-1.5 rounded-lg border bg-card/95 px-2 py-1 text-label-compact shadow-sm backdrop-blur-sm"
          role="status"
        >
          {loading || layoutPending ? (
            <LoadingMoreIcon aria-hidden="true" className="animate-spin" />
          ) : (
            <ResourceGraphIcon aria-hidden="true" />
          )}
          {loading
            ? "Loading"
            : layoutEngine === "fallback"
              ? "Simplified layout"
              : "Arranging"}
        </div>
      ) : null}
      <ResourceGraphLegend />
    </div>
  )
}

function GraphControl({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
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

function GraphExpansionMenu({
  expansionStates,
  nodes,
  onExpand,
}: {
  expansionStates: ReadonlyMap<string, GraphExpansionState>
  nodes: readonly WorkspaceResourceGraphNode[]
  onExpand: (nodeMfid: string, mode: GraphExpansionMode) => void
}) {
  const expandableNodes = nodes.filter((node) =>
    graphNodeCanExpand(node, expansionStates)
  )
  if (expandableNodes.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="sm" type="button" variant="outline">
            <ExpandGraphNodeIcon aria-hidden="true" />
            Expand
          </Button>
        }
      />
      <DropdownMenuContent className="max-w-72 min-w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Expand from</DropdownMenuLabel>
          {expandableNodes.map((node) => (
            <DropdownMenuSub key={node.unique_id}>
              <DropdownMenuSubTrigger>
                <ResourceTypeIcon type={node.kind} />
                <span className="min-w-0 flex-1 truncate">{node.name}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-40">
                <GraphExpansionModeItems
                  expansionStates={expansionStates}
                  node={node}
                  onExpand={onExpand}
                />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function GraphExpansionModeItems({
  expansionStates,
  node,
  onExpand,
}: {
  expansionStates: ReadonlyMap<string, GraphExpansionState>
  node: WorkspaceResourceGraphNode
  onExpand: (nodeMfid: string, mode: GraphExpansionMode) => void
}) {
  return graphExpansionModes.map((mode) => {
    const state = graphExpansionState(expansionStates, node.unique_id, mode)
    const pending = graphExpansionPending(state)
    const Icon = graphExpansionModeIcon(mode)
    return (
      <DropdownMenuItem
        disabled={pending || state?.isSuccess}
        key={mode}
        onClick={() => onExpand(node.unique_id, mode)}
      >
        {pending ? (
          <LoadingMoreIcon aria-hidden="true" className="animate-spin" />
        ) : (
          <Icon aria-hidden="true" />
        )}
        <span className="flex-1">{graphExpansionModeLabel(mode)}</span>
        {state?.isError ? (
          <span className="text-supporting text-destructive">Retry</span>
        ) : state?.isSuccess ? (
          <span className="text-supporting text-muted-foreground">Loaded</span>
        ) : null}
      </DropdownMenuItem>
    )
  })
}

function graphExpansionModeIcon(mode: GraphExpansionMode) {
  if (mode === "ancestors") return GraphAncestorsIcon
  if (mode === "descendants") return GraphDescendantsIcon
  return GraphAssociationsIcon
}

function graphElements(
  graph: WorkspaceResourceGraph,
  rootContext: string | null,
  labelMetrics: GraphLabelMetrics
): ElementDefinition[] {
  return [
    ...graph.nodes.map((node) => ({
      data: {
        id: node.unique_id,
        isRoot: node.unique_id === graph.rootMfid,
        kind: node.kind,
        label: graphNodeLabel(
          node,
          node.unique_id === graph.rootMfid ? rootContext : null,
          labelMetrics
        ),
      },
      group: "nodes" as const,
    })),
    ...graph.edges.map((edge) => ({
      data: {
        id: edge.id,
        relationship: edge.relationship,
        relationshipType: edge.relationshipType,
        source: edge.source,
        target: edge.target,
      },
      group: "edges" as const,
    })),
  ]
}

function updateGraphElements(
  instance: Core,
  definitions: readonly ElementDefinition[],
  graph: WorkspaceResourceGraph
) {
  const nodeDefinitions = definitions.filter(
    (definition) => definition.group === "nodes"
  )
  const edgeDefinitions = definitions.filter(
    (definition) => definition.group === "edges"
  )
  const nextIds = new Set(
    definitions.flatMap((definition) =>
      typeof definition.data.id === "string" ? [definition.data.id] : []
    )
  )
  const previousNodeIds = new Set(
    instance.nodes("[!graphAction]").map((node) => node.id())
  )
  instance.batch(() => {
    instance
      .elements()
      .filter((element) => !nextIds.has(element.id()))
      .remove()
    for (const definition of nodeDefinitions) {
      const id = definition.data.id
      if (typeof id !== "string") continue
      const existing = instance.$id(id)
      if (existing.length) {
        existing.data(definition.data)
        continue
      }
      const added = instance.add(definition)
      const neighbour = graph.edges
        .filter((edge) => edge.source === id || edge.target === id)
        .map((edge) => (edge.source === id ? edge.target : edge.source))
        .find((candidate) => previousNodeIds.has(candidate))
      if (neighbour) added.position(instance.$id(neighbour).position())
    }
    for (const definition of edgeDefinitions) {
      const id = definition.data.id
      if (typeof id !== "string") continue
      const existing = instance.$id(id)
      if (existing.length) existing.data(definition.data)
      else instance.add(definition)
    }
  })
}

function graphElkLayout(element: HTMLElement, animate: boolean) {
  return {
    name: "elk",
    animate,
    animationDuration: graphNumberToken(element, "--graph-layout-duration"),
    animationEasing: "ease-out-cubic",
    fit: false,
    nodeDimensionsIncludeLabels: false,
    padding: graphNumberToken(element, "--graph-fit-padding"),
    elk: {
      algorithm: "layered",
      "elk.direction": graphStringToken(element, "--graph-layout-direction"),
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.nodePlacement.favorStraightEdges": true,
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.layered.spacing.nodeNodeBetweenLayers": graphNumberToken(
        element,
        "--graph-layout-layer-gap"
      ),
      "elk.spacing.nodeNode": graphNumberToken(
        element,
        "--graph-layout-node-gap"
      ),
    },
  }
}

function graphFallbackLayout(element: HTMLElement) {
  return {
    name: "breadthfirst",
    animate: false,
    circle: false,
    directed: true,
    fit: false,
    padding: graphNumberToken(element, "--graph-fit-padding"),
    spacingFactor: graphNumberToken(element, "--graph-fallback-spacing"),
  }
}

function graphDensity(nodeCount: number) {
  if (nodeCount <= 3) return "sparse"
  if (nodeCount >= 12) return "dense"
  return "standard"
}

function graphStyles(element: HTMLElement): StylesheetJson {
  const style = getComputedStyle(element)
  const token = (name: string) => style.getPropertyValue(name).trim()
  return [
    {
      selector: "node",
      style: {
        "background-color": token("--graph-card"),
        "background-fit": "none",
        "background-height": graphNumberToken(element, "--graph-icon-size"),
        "background-position-x": graphNumberToken(
          element,
          "--graph-icon-position-x"
        ),
        "background-position-y": graphNumberToken(
          element,
          "--graph-icon-position-y"
        ),
        "background-repeat": "no-repeat",
        "background-width": graphNumberToken(element, "--graph-icon-size"),
        "border-color": token("--graph-edge"),
        "border-width": graphNumberToken(element, "--graph-node-border"),
        color: token("--graph-foreground"),
        "font-family": token("--font-sans"),
        "font-size": graphNumberToken(element, "--graph-font-size"),
        "font-weight": 500,
        height: graphNumberToken(element, "--graph-node-height"),
        label: "data(label)",
        "line-height": 1.25,
        shape: "round-rectangle",
        "text-max-width": `${graphNumberToken(element, "--graph-label-width")}px`,
        "text-halign": "left-inside",
        "text-justification": "left",
        "text-margin-x": graphNumberToken(element, "--graph-label-offset-x"),
        "text-overflow-wrap": "anywhere",
        "text-valign": "center",
        "text-wrap": "wrap",
        width: graphNumberToken(element, "--graph-node-width"),
      },
    },
    {
      selector: 'node[kind = "sample"]',
      style: {
        "background-color": token("--graph-resource-sample-surface"),
        "background-image": resourceTypeGraphIconDataUri(
          "sample",
          token("--graph-resource-sample")
        ),
        "border-color": token("--graph-resource-sample"),
      },
    },
    {
      selector: 'node[kind = "dataset"]',
      style: {
        "background-color": token("--graph-resource-dataset-surface"),
        "background-image": resourceTypeGraphIconDataUri(
          "dataset",
          token("--graph-resource-dataset")
        ),
        "border-color": token("--graph-resource-dataset"),
      },
    },
    {
      selector: "node[?graphAction]",
      style: {
        "background-color": token("--graph-action-surface"),
        "background-image": "none",
        "border-color": token("--graph-action-border"),
        "border-width": graphNumberToken(
          element,
          "--graph-action-border-width"
        ),
        color: token("--graph-action-foreground"),
        "font-size": graphNumberToken(element, "--graph-action-font-size"),
        "font-weight": 600,
        height: graphNumberToken(element, "--graph-action-height"),
        label: "data(label)",
        "overlay-opacity": 0,
        shape: "round-rectangle",
        "text-halign": "center",
        "text-margin-x": 0,
        "text-valign": "center",
        "text-wrap": "none",
        width: graphNumberToken(element, "--graph-action-width"),
      },
    },
    {
      selector: 'node[actionKind = "trigger"]',
      style: {
        "border-color": token("--graph-action-accent"),
        "font-size": graphNumberToken(
          element,
          "--graph-action-trigger-font-size"
        ),
        height: graphNumberToken(element, "--graph-action-trigger-size"),
        shape: "ellipse",
        width: graphNumberToken(element, "--graph-action-trigger-size"),
      },
    },
    {
      selector: "node[?actionPending]",
      style: {
        opacity: graphNumberToken(element, "--graph-action-pending-opacity"),
      },
    },
    {
      selector: "node[?actionError]",
      style: {
        "border-color": token("--graph-action-error"),
        color: token("--graph-action-error"),
      },
    },
    {
      selector: "node[?isRoot]",
      style: {
        "border-color": token("--graph-current"),
        "border-width": graphNumberToken(element, "--graph-root-border"),
        "font-weight": 600,
        height: graphNumberToken(element, "--graph-root-node-height"),
        "overlay-color": token("--graph-current"),
        "overlay-opacity": graphNumberToken(
          element,
          "--graph-root-overlay-opacity"
        ),
        "overlay-padding": graphNumberToken(
          element,
          "--graph-root-overlay-padding"
        ),
        width: graphNumberToken(element, "--graph-root-node-width"),
      },
    },
    {
      selector: "node:selected",
      style: {
        "border-color": token("--graph-ring"),
        "overlay-color": token("--graph-ring"),
        "overlay-opacity": graphNumberToken(
          element,
          "--graph-selected-overlay-opacity"
        ),
        "overlay-padding": graphNumberToken(
          element,
          "--graph-selected-overlay-padding"
        ),
      },
    },
    {
      selector: "node.graph-hovered",
      style: {
        "overlay-color": token("--graph-ring"),
        "overlay-opacity": graphNumberToken(
          element,
          "--graph-hover-overlay-opacity"
        ),
        "overlay-padding": graphNumberToken(
          element,
          "--graph-hover-overlay-padding"
        ),
      },
    },
    {
      selector: "edge",
      style: {
        "curve-style": "taxi",
        "line-color": token("--graph-edge"),
        "taxi-direction": "horizontal",
        "taxi-turn": "50%",
        "taxi-turn-min-distance": 16,
        "target-arrow-color": token("--graph-edge"),
        "target-arrow-shape": "triangle",
        width: graphNumberToken(element, "--graph-edge-width"),
      },
    },
    {
      selector: 'edge[relationship = "associated"]',
      style: {
        "curve-style": "bezier",
        "line-style": "dashed",
        "target-arrow-shape": "none",
      },
    },
    {
      selector: ".graph-muted",
      style: {
        opacity: graphNumberToken(element, "--graph-muted-opacity"),
      },
    },
    {
      selector: "edge.graph-highlighted",
      style: {
        "line-color": token("--graph-highlight"),
        "target-arrow-color": token("--graph-highlight"),
        width: graphNumberToken(element, "--graph-highlighted-edge-width"),
      },
    },
  ]
}

function graphNodeLabel(
  node: WorkspaceResourceGraphNode,
  rootContext: string | null,
  metrics: GraphLabelMetrics
) {
  const context = rootContext ?? node.context
  return [
    ...wrapGraphNodeName(node.name, metrics),
    ...(context ? [fitGraphLabelLine(context, metrics)] : []),
  ].join("\n")
}

function wrapGraphNodeName(value: string, metrics: GraphLabelMetrics) {
  const characters = Array.from(value.trim() || "Unnamed resource")
  if (metrics.measure(characters.join("")) <= metrics.maxWidth) {
    return [characters.join("")]
  }
  const fittedCharacters = graphFittedCharacterCount(characters, metrics)
  const firstBreak = graphLineBreak(characters, fittedCharacters)
  if (firstBreak === characters.length) return [characters.join("")]
  const firstLine = characters.slice(0, firstBreak).join("").trimEnd()
  const remaining = characters.slice(firstBreak).join("").trimStart()
  return [firstLine, fitGraphLabelLine(remaining, metrics)]
}

function graphLineBreak(characters: readonly string[], limit: number) {
  if (characters.length <= limit) return characters.length
  const minimumPreferredBreak = Math.ceil(limit * 0.55)
  for (let index = limit; index >= minimumPreferredBreak; index -= 1) {
    if (/\s|[_+/.-]/.test(characters[index - 1] ?? "")) return index
  }
  return limit
}

function fitGraphLabelLine(value: string, metrics: GraphLabelMetrics) {
  const characters = Array.from(value.trim())
  if (metrics.measure(characters.join("")) <= metrics.maxWidth) {
    return characters.join("")
  }
  const ellipsis = "…"
  while (
    characters.length > 0 &&
    metrics.measure(`${characters.join("").trimEnd()}${ellipsis}`) >
      metrics.maxWidth
  ) {
    characters.pop()
  }
  return `${characters.join("").trimEnd()}${ellipsis}`
}

function graphFittedCharacterCount(
  characters: readonly string[],
  metrics: GraphLabelMetrics
) {
  let fitted = 1
  while (
    fitted < characters.length &&
    metrics.measure(characters.slice(0, fitted + 1).join("")) <=
      metrics.maxWidth
  ) {
    fitted += 1
  }
  return fitted
}

function graphLabelMetrics(element: HTMLElement): GraphLabelMetrics {
  const context = document.createElement("canvas").getContext("2d")
  const style = getComputedStyle(element)
  const fontSize = graphNumberToken(element, "--graph-font-size")
  if (context) {
    context.font = `600 ${fontSize}px ${style.getPropertyValue("--font-sans").trim()}`
  }
  return {
    maxWidth: graphNumberToken(element, "--graph-label-width"),
    measure: (value) =>
      context?.measureText(value).width ?? value.length * fontSize,
  }
}

function zoomGraph(instance: Core | null, factor: number) {
  if (!instance) return
  const root = instance.$("node[?isRoot]")
  instance.scratch("resourceGraphViewportChanged", true)
  instance.zoom({
    level: instance.zoom() * factor,
    renderedPosition: root.renderedPosition(),
  })
}

function centerCurrentResource(instance: Core) {
  const root = instance.$("node[?isRoot]")
  if (!root.length) return
  const container = instance.container()
  if (!container) return
  const padding = graphNumberToken(container, "--graph-fit-padding")
  const bounds = graphContentElements(instance).boundingBox({
    includeLabels: true,
    includeOverlays: true,
  })
  const rootPosition = root.position()
  const horizontalExtent = Math.max(
    rootPosition.x - bounds.x1,
    bounds.x2 - rootPosition.x
  )
  const verticalExtent = Math.max(
    rootPosition.y - bounds.y1,
    bounds.y2 - rootPosition.y
  )
  const availableWidth = Math.max(container.clientWidth - padding * 2, 1)
  const availableHeight = Math.max(container.clientHeight - padding * 2, 1)
  const zoom = Math.min(
    availableWidth / Math.max(horizontalExtent * 2, 1),
    availableHeight / Math.max(verticalExtent * 2, 1),
    instance.maxZoom()
  )
  const readableZoom = graphNumberToken(container, "--graph-readable-zoom")
  instance.scratch("resourceGraphViewportChanged", false)
  instance.zoom(Math.max(zoom, readableZoom, instance.minZoom()))
  instance.center(root)
  instance.panBy({
    x: 0,
    y: graphNumberToken(container, "--graph-center-offset-y"),
  })
}

function graphContentElements(instance: Core) {
  return instance.elements("node[!graphAction], edge")
}

function graphNumberToken(element: HTMLElement, name: string) {
  const value = Number(getComputedStyle(element).getPropertyValue(name))
  if (!Number.isFinite(value)) throw new Error(`Invalid graph token: ${name}`)
  return value
}

function graphStringToken(element: HTMLElement, name: string) {
  const value = getComputedStyle(element).getPropertyValue(name).trim()
  if (!value) throw new Error(`Invalid graph token: ${name}`)
  return value
}

function ResourceGraphTable({
  expansionStates,
  graph,
  nodes,
  onExpand,
  thumbnails,
}: {
  expansionStates: ReadonlyMap<string, GraphExpansionState>
  graph: WorkspaceResourceGraph
  nodes: readonly WorkspaceResourceGraphNode[]
  onExpand: (nodeMfid: string, mode: GraphExpansionMode) => void
  thumbnails: Readonly<Partial<Record<string, WorkspaceDatasetThumbnail>>>
}) {
  return (
    <Card>
      <CardHeader actionLayout="inline">
        <CardTitle>Relationships</CardTitle>
        <CardAction>
          <Badge variant="outline">{nodes.length}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        {nodes.length === 0 ? (
          <p className="border-t px-4 pt-4 text-body text-muted-foreground">
            No immediate relationships are recorded.
          </p>
        ) : (
          <div className="border-t">
            <Table className="resource-graph-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Relationship</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nodes.map((node) => {
                  const thumbnail = thumbnails[node.unique_id]
                  const typeLabel = relationshipTypeLabel(graph, node)
                  return (
                    <TableRow key={node.unique_id}>
                      <TableCell
                        className="resource-graph-relationship"
                        data-label="Relationship"
                      >
                        <Badge variant="outline">
                          {relationshipLabel(graph, node)}
                        </Badge>
                        {typeLabel ? (
                          <span className="mt-1 block text-supporting text-muted-foreground">
                            {typeLabel}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="resource-graph-resource">
                        <span className="flex min-w-0 items-center gap-3">
                          {thumbnail ? (
                            <DatasetThumbnailImage
                              alt=""
                              className="size-10 shrink-0 rounded-md border bg-card object-contain"
                              thumbnail={thumbnail}
                            />
                          ) : null}
                          <span className="flex min-w-0 items-center gap-2">
                            <ResourceTypeIcon
                              className="size-5 shrink-0"
                              type={node.kind}
                            />
                            <span className="sr-only">
                              {node.kind === "sample" ? "Sample" : "Dataset"}
                              {": "}
                            </span>
                            <ResourcePreviewLink
                              className="min-w-0 text-label break-words hover:underline"
                              mfid={node.unique_id}
                              resourceKind={node.kind}
                              resourceName={node.name}
                            >
                              {node.name}
                            </ResourcePreviewLink>
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="resource-graph-action">
                        <span className="flex justify-end gap-1">
                          <GraphExpansionAction
                            expansionStates={expansionStates}
                            node={node}
                            onExpand={onExpand}
                          />
                          <ResourceFullPageLink
                            kind={node.kind}
                            mfid={node.unique_id}
                            name={node.name}
                            presentation="table"
                          />
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function GraphExpansionAction({
  expansionStates,
  node,
  onExpand,
}: {
  expansionStates: ReadonlyMap<string, GraphExpansionState>
  node: WorkspaceResourceGraphNode
  onExpand: (nodeMfid: string, mode: GraphExpansionMode) => void
}) {
  if (!graphNodeCanExpand(node, expansionStates)) return null
  const pending = graphExpansionModes.some((mode) =>
    graphExpansionPending(
      graphExpansionState(expansionStates, node.unique_id, mode)
    )
  )

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label={`Expand graph from ${node.name}`}
                  size="table-action"
                  type="button"
                  variant="outline"
                />
              }
            />
          }
        >
          {pending ? (
            <LoadingMoreIcon aria-hidden="true" className="animate-spin" />
          ) : (
            <ExpandGraphNodeIcon aria-hidden="true" />
          )}
        </TooltipTrigger>
        <TooltipContent>Expand graph</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Expand from {node.name}</DropdownMenuLabel>
          <GraphExpansionModeItems
            expansionStates={expansionStates}
            node={node}
            onExpand={onExpand}
          />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function isGraphExpansionMode(value: unknown): value is GraphExpansionMode {
  return graphExpansionModes.some((mode) => mode === value)
}

function graphExpansionControlLabel(
  mode: GraphExpansionMode,
  state?: GraphExpansionState
) {
  const label = graphExpansionModeLabel(mode).toLowerCase()
  if (graphExpansionPending(state)) return `Loading ${label}`
  if (state?.isError) return `Retry ${label}`
  return graphExpansionModeLabel(mode)
}

function syncGraphExpansionControls(
  instance: Core,
  nodes: readonly WorkspaceResourceGraphNode[],
  expansionStates: ReadonlyMap<string, GraphExpansionState>,
  activeNodeMfid: string | null
) {
  const container = instance.container()
  if (!container || instance.destroyed()) return
  const actionNodes: ElementDefinition[] = []
  for (const node of nodes) {
    if (!graphNodeCanExpand(node, expansionStates)) continue
    const resourceNode = instance.getElementById(node.unique_id)
    if (!resourceNode.length) continue
    const position = resourceNode.position()
    const bounds = resourceNode.boundingBox({
      includeLabels: false,
      includeOverlays: false,
    })
    const triggerGap = graphNumberToken(container, "--graph-action-trigger-gap")
    const triggerSize = graphNumberToken(
      container,
      "--graph-action-trigger-size"
    )
    const triggerPosition = {
      x: bounds.x2 + triggerGap + triggerSize / 2,
      y: bounds.y1 + triggerSize / 2,
    }
    actionNodes.push({
      data: {
        actionKind: "trigger",
        actionTarget: node.unique_id,
        graphAction: true,
        id: graphExpansionControlId(node.unique_id, "trigger"),
        label: "+",
      },
      grabbable: false,
      group: "nodes",
      locked: true,
      position: triggerPosition,
      selectable: false,
    })
    if (activeNodeMfid !== node.unique_id) continue
    const actionHeight = graphNumberToken(container, "--graph-action-height")
    const actionWidth = graphNumberToken(container, "--graph-action-width")
    const actionGap = graphNumberToken(container, "--graph-action-gap")
    const actionX =
      triggerPosition.x + triggerSize / 2 + actionGap + actionWidth / 2
    const availableModes = graphExpansionModes.filter(
      (mode) =>
        !graphExpansionState(expansionStates, node.unique_id, mode)?.isSuccess
    )
    availableModes.forEach((mode, index) => {
      const state = graphExpansionState(expansionStates, node.unique_id, mode)
      actionNodes.push({
        data: {
          actionError: Boolean(state?.isError),
          actionKind: "mode",
          actionPending: graphExpansionPending(state),
          actionTarget: node.unique_id,
          expansionMode: mode,
          graphAction: true,
          id: graphExpansionControlId(node.unique_id, mode),
          label: graphExpansionControlLabel(mode, state),
        },
        grabbable: false,
        group: "nodes",
        locked: true,
        position: {
          x: actionX,
          y:
            position.y +
            (index - (availableModes.length - 1) / 2) *
              (actionHeight + actionGap),
        },
        selectable: false,
      })
    })
  }
  instance.batch(() => {
    instance.nodes("[?graphAction]").remove()
    if (actionNodes.length) instance.add(actionNodes)
  })
}

function graphExpansionControlId(
  nodeMfid: string,
  action: GraphExpansionMode | "trigger"
) {
  return `graph-action:${nodeMfid}:${action}`
}

function relationshipLabel(
  graph: WorkspaceResourceGraph,
  node: WorkspaceResourceGraphNode
) {
  const edge = graph.edges.find(
    (candidate) =>
      (candidate.source === node.unique_id &&
        candidate.target === graph.rootMfid) ||
      (candidate.source === graph.rootMfid &&
        candidate.target === node.unique_id)
  )
  if (!edge) return "Related"
  if (edge.relationship === "associated") return "Associated"
  if (edge.target === graph.rootMfid) return "Parent"
  if (edge.source === graph.rootMfid) return "Child"
  return "Lineage"
}

function relationshipTypeLabel(
  graph: WorkspaceResourceGraph,
  node: WorkspaceResourceGraphNode
) {
  const edge = graph.edges.find(
    (candidate) =>
      candidate.relationship === "parent" &&
      ((candidate.source === node.unique_id &&
        candidate.target === graph.rootMfid) ||
        (candidate.source === graph.rootMfid &&
          candidate.target === node.unique_id))
  )
  if (!edge?.relationshipType) return null
  const relationship = edge.target === graph.rootMfid ? "parent" : "child"
  return workspaceRelationshipTypeLabel({
    relationship,
    relationship_type: edge.relationshipType,
  })
}

function graphErrorMessage(error: Error | null) {
  if (!(error instanceof HubApiClientError)) {
    return "The resource graph could not be loaded."
  }
  if (error.details.kind === "forbidden") {
    return "You do not have permission to view this resource graph."
  }
  if (error.details.kind === "not-found") {
    return "This resource graph is no longer available."
  }
  return `${error.details.message} Reference: ${error.details.correlationId}`
}
