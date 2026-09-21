import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { RefObject } from "react"
import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query"

import {
  ExpandGraphNodeIcon,
  GraphAncestorsIcon,
  GraphAssociationsIcon,
  GraphDescendantsIcon,
  LoadingMoreIcon,
  ResourceGraphIcon,
} from "@/components/crucible/icons"
import { DatasetThumbnailImage } from "@/components/crucible/dataset-thumbnail"
import { ResourceFullPageLink } from "@/components/crucible/resource-full-page-link"
import { ResourceIdentity } from "@/components/crucible/resource-identity"
import {
  ResourcePreviewLink,
  useResourcePreviewContext,
} from "@/components/crucible/resource-preview-navigation"
import {
  staticResourceSiblingCollection,
  useRegisterResourceSiblings,
} from "@/components/crucible/resource-sibling-navigation"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import type { IdentityScope } from "@/data/crucible/query-keys"
import {
  compareWorkspaceRelationshipResources,
  workspaceRelationshipTypeLabel,
} from "@/data/crucible/resource-relationships"
import type {
  WorkspaceDatasetThumbnail,
  WorkspaceResourceGraph,
  WorkspaceResourceGraphNode,
} from "@/data/crucible/workspace-source"
import { ResourceGraphCanvas } from "./resource-graph-canvas"
import {
  graphExpansionKey,
  graphExpansionModeLabel,
  graphExpansionModesByNode,
  graphExpansionModesForNode,
  graphExpansionPending,
  graphExpansionQuery,
  graphExpansionState,
  graphNodeCanExpand,
} from "./resource-graph-expansion"
import type {
  GraphExpansionMode,
  GraphExpansionRequest,
  GraphExpansionState,
} from "./resource-graph-expansion"
import { mergeResourceGraphs } from "./resource-graph-merge"
import { graphWithoutAssociations } from "./resource-graph-display"
import type { ResourceGraphDisplay } from "./resource-graph-display"

type GraphExpansionQueryResult = {
  data?: WorkspaceResourceGraph
  isError: boolean
  isFetching: boolean
  isPending: boolean
  isSuccess: boolean
  refetch: () => Promise<unknown>
}

type GraphThumbnailQueryResult = {
  data?: Readonly<Partial<Record<string, WorkspaceDatasetThumbnail>>>
}

const initialLineageDepth = 3
const GRAPH_TABLE_ROW_BATCH = 50

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

function combineGraphThumbnailQueries(
  results: readonly GraphThumbnailQueryResult[]
) {
  return Object.assign(
    {},
    ...results.flatMap((result) => (result.data ? [result.data] : []))
  )
}

export function ResourceGraphPage({
  display,
  onDisplayChange,
  resourceKind,
  resourceMfid,
}: {
  display: ResourceGraphDisplay
  onDisplayChange: (changes: Partial<ResourceGraphDisplay>) => void
  resourceKind: "dataset" | "sample"
  resourceMfid: string
}) {
  const scope = useWorkspaceScope()
  const navigation = useResourcePreviewContext()
  const [expansion, setExpansion] = useState({
    resourceMfid,
    requests: [] as GraphExpansionRequest[],
  })
  const expansionRequests =
    expansion.resourceMfid === resourceMfid ? expansion.requests : []
  const query = useQuery({
    ...resourceGraphQueryOptions(scope, resourceMfid, {
      depth: initialLineageDepth,
      direction: "upstream",
      relationshipKinds: ["lineage"],
    }),
    placeholderData: keepPreviousData,
  })
  const descendantQuery = useQuery({
    ...resourceGraphQueryOptions(scope, resourceMfid, {
      depth: initialLineageDepth,
      direction: "downstream",
      relationshipKinds: ["lineage"],
    }),
    placeholderData: keepPreviousData,
  })
  const associationQuery = useQuery({
    ...resourceGraphQueryOptions(scope, resourceMfid, {
      depth: 1,
      relationshipKinds: ["association"],
    }),
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
    if (
      query.isPending ||
      query.isPlaceholderData ||
      descendantQuery.isPending ||
      descendantQuery.isPlaceholderData ||
      associationQuery.isPending
    )
      return undefined
    const graphs = [
      query.data,
      descendantQuery.data,
      associationQuery.data,
    ].flatMap((graph) => (graph ? [graph] : []))
    if (graphs.length === 0) return undefined
    const [baseGraph, ...additionalGraphs] = graphs
    if (additionalGraphs.length === 0) {
      return baseGraph
    }
    return mergeResourceGraphs(baseGraph, additionalGraphs)
  }, [
    associationQuery.data,
    descendantQuery.data,
    descendantQuery.isPlaceholderData,
    descendantQuery.isPending,
    query.data,
    query.isPlaceholderData,
    query.isPending,
    associationQuery.isPending,
  ])
  const displayedGraph = useMemo(() => {
    if (!rootGraph) return undefined
    return mergeResourceGraphs(rootGraph, expansions.graphs)
  }, [expansions.graphs, rootGraph])
  const canvasGraph = useMemo(() => {
    if (!displayedGraph || display.associations) return displayedGraph
    return graphWithoutAssociations(displayedGraph)
  }, [display.associations, displayedGraph])
  const graphThumbnailBatches = useMemo(() => {
    if (!display.thumbnails || !canvasGraph) return []
    const datasetMfids = canvasGraph.nodes
      .filter((node) => node.kind === "dataset")
      .map((node) => node.unique_id)
    return Array.from(
      { length: Math.ceil(datasetMfids.length / THUMBNAIL_PREVIEW_BATCH_MAX) },
      (_, index) =>
        datasetMfids.slice(
          index * THUMBNAIL_PREVIEW_BATCH_MAX,
          (index + 1) * THUMBNAIL_PREVIEW_BATCH_MAX
        )
    )
  }, [canvasGraph, display.thumbnails])
  const graphThumbnails = useQueries({
    queries: graphThumbnailBatches.map((datasetMfids) => ({
      ...datasetThumbnailPreviewsQueryOptions(scope, datasetMfids),
      enabled: datasetMfids.length > 0,
    })),
    combine: combineGraphThumbnailQueries,
  })
  const expansionStates = useMemo(
    () =>
      new Map<string, GraphExpansionState>(
        expansionRequests.map((request, index) => [
          graphExpansionKey(request.nodeMfid, request.mode),
          expansions.states[index],
        ])
      ),
    [expansionRequests, expansions.states]
  )
  const expansionModesByNode = useMemo(
    () =>
      displayedGraph
        ? graphExpansionModesByNode(displayedGraph)
        : new Map<string, readonly GraphExpansionMode[]>(),
    [displayedGraph]
  )
  const relatedNodes = useMemo(
    () =>
      displayedGraph?.nodes.filter(
        (node) => node.unique_id !== displayedGraph.rootMfid
      ) ?? [],
    [displayedGraph]
  )
  const nodesByMfid = useMemo(
    () =>
      new Map(
        displayedGraph?.nodes.map((node) => [node.unique_id, node]) ?? []
      ),
    [displayedGraph]
  )
  const rootContext = displayedGraph
    ? (nodesByMfid.get(displayedGraph.rootMfid)?.context ?? null)
    : null
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

  const expandNode = useCallback(
    (nodeMfid: string, mode: GraphExpansionMode) => {
      if (mode === "associations" && !display.associations) {
        onDisplayChange({ associations: true })
      }
      const state = expansionStates.get(graphExpansionKey(nodeMfid, mode))
      if (state?.isError) {
        void state.refetch()
        return
      }
      setExpansion((current) => {
        const requests =
          current.resourceMfid === resourceMfid ? current.requests : []
        if (
          requests.some(
            (request) => request.nodeMfid === nodeMfid && request.mode === mode
          )
        ) {
          return current
        }
        return {
          resourceMfid,
          requests: [...requests, { mode, nodeMfid }],
        }
      })
    },
    [display.associations, expansionStates, onDisplayChange, resourceMfid]
  )
  const inspectNode = useCallback(
    (mfid: string, trigger: HTMLElement) => {
      const node = nodesByMfid.get(mfid)
      navigation.open(
        mfid,
        trigger,
        node ? { kind: node.kind, mfid, name: node.name } : undefined
      )
    },
    [navigation, nodesByMfid]
  )

  if (
    !displayedGraph &&
    (query.isPending || descendantQuery.isPending || associationQuery.isPending)
  ) {
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
          <EmptyDescription>
            {graphErrorMessage(
              query.error ?? descendantQuery.error ?? associationQuery.error
            )}
          </EmptyDescription>
        </EmptyHeader>
        <Button
          onClick={() => {
            void query.refetch()
            void descendantQuery.refetch()
            void associationQuery.refetch()
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          Try again
        </Button>
      </Empty>
    )
  }

  const isExpanding = expansions.isFetching

  return (
    <section
      aria-busy={
        query.isFetching ||
        descendantQuery.isFetching ||
        associationQuery.isFetching ||
        isExpanding
      }
      aria-label="Resource graph"
      className="flex min-w-0 flex-col gap-4"
    >
      {query.isError || descendantQuery.isError ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3"
          role="alert"
        >
          <p className="text-body text-muted-foreground">
            Some lineage directions could not be refreshed. Showing the
            available paths.
          </p>
          <Button
            onClick={() => {
              if (query.isError) void query.refetch()
              if (descendantQuery.isError) void descendantQuery.refetch()
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            Try again
          </Button>
        </div>
      ) : null}

      {associationQuery.isError ? (
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
          display={display}
          expansionStates={expansionStates}
          expansionModesByNode={expansionModesByNode}
          graph={canvasGraph ?? displayedGraph}
          loading={
            query.isFetching ||
            descendantQuery.isFetching ||
            associationQuery.isFetching ||
            isExpanding
          }
          onDisplayChange={onDisplayChange}
          onExpand={expandNode}
          rootContext={rootContext}
          onInspect={inspectNode}
          thumbnails={graphThumbnails}
        />
      )}

      {expansions.states.some((state) => state.isError) ? (
        <p className="text-body text-destructive" role="alert">
          The graph could not be expanded. Use the retry action beside the
          affected resource.
        </p>
      ) : null}

      <ResourceGraphTable
        expansionModesByNode={expansionModesByNode}
        expansionStates={expansionStates}
        graph={displayedGraph}
        nodes={relatedNodes}
        onExpand={expandNode}
        scope={scope}
      />
    </section>
  )
}

function ResourceGraphPending() {
  return (
    <div
      aria-label="Loading resource graph"
      className="flex flex-col gap-4"
      role="status"
    >
      <Skeleton className="min-h-graph-canvas w-full" />
      <Card aria-busy="true">
        <CardHeader>
          <CardTitle>Relationships</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 border-t pt-4">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-5 w-2/3" />
        </CardContent>
      </Card>
    </div>
  )
}

function GraphExpansionModeItems({
  availableModes,
  expansionStates,
  node,
  onExpand,
}: {
  availableModes?: readonly GraphExpansionMode[]
  expansionStates: ReadonlyMap<string, GraphExpansionState>
  node: WorkspaceResourceGraphNode
  onExpand: (nodeMfid: string, mode: GraphExpansionMode) => void
}) {
  return graphExpansionModesForNode(node, expansionStates, availableModes).map(
    (mode) => {
      const state = graphExpansionState(expansionStates, node.unique_id, mode)
      const pending = graphExpansionPending(state)
      const Icon = graphExpansionModeIcon(mode)
      return (
        <DropdownMenuItem
          disabled={pending}
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
          ) : null}
        </DropdownMenuItem>
      )
    }
  )
}

function graphExpansionModeIcon(mode: GraphExpansionMode) {
  if (mode === "ancestors") return GraphAncestorsIcon
  if (mode === "descendants") return GraphDescendantsIcon
  return GraphAssociationsIcon
}

function ResourceGraphTable({
  expansionModesByNode,
  expansionStates,
  graph,
  nodes,
  onExpand,
  scope,
}: {
  expansionModesByNode: ReadonlyMap<string, readonly GraphExpansionMode[]>
  expansionStates: ReadonlyMap<string, GraphExpansionState>
  graph: WorkspaceResourceGraph
  nodes: readonly WorkspaceResourceGraphNode[]
  onExpand: (nodeMfid: string, mode: GraphExpansionMode) => void
  scope: IdentityScope
}) {
  const container = useRef<HTMLDivElement>(null)
  const nearViewport = useNearViewport(container)
  const [visibleCount, setVisibleCount] = useState(
    Math.min(nodes.length, GRAPH_TABLE_ROW_BATCH)
  )
  useEffect(() => {
    setVisibleCount((current) =>
      Math.min(nodes.length, Math.max(current, GRAPH_TABLE_ROW_BATCH))
    )
  }, [nodes.length])
  const relationships = useMemo(
    () => graphRelationshipPresentations(graph),
    [graph]
  )
  const sortedNodes = useMemo(
    () =>
      [...nodes].sort((left, right) => {
        const relationshipDifference =
          graphRelationshipOrder(relationships.get(left.unique_id)) -
          graphRelationshipOrder(relationships.get(right.unique_id))
        return (
          relationshipDifference ||
          compareWorkspaceRelationshipResources(left, right)
        )
      }),
    [nodes, relationships]
  )
  const visibleNodes = useMemo(
    () => sortedNodes.slice(0, visibleCount),
    [sortedNodes, visibleCount]
  )
  const datasetMfids = useMemo(
    () =>
      visibleNodes
        .filter((node) => node.kind === "dataset")
        .slice(0, THUMBNAIL_PREVIEW_BATCH_MAX)
        .map((node) => node.unique_id),
    [visibleNodes]
  )
  const thumbnailQuery = useQuery({
    ...datasetThumbnailPreviewsQueryOptions(scope, datasetMfids),
    enabled: nearViewport && datasetMfids.length > 0,
  })
  const hasMoreRows = visibleCount < nodes.length

  return (
    <Card ref={container}>
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
                {visibleNodes.map((node) => {
                  const thumbnail = thumbnailQuery.data?.[node.unique_id]
                  const relationship = relationships.get(node.unique_id)
                  return (
                    <TableRow key={node.unique_id}>
                      <TableCell
                        className="resource-graph-relationship"
                        data-label="Relationship"
                      >
                        <Badge variant="outline">
                          {relationship?.label ?? "Related"}
                        </Badge>
                        {relationship?.typeLabel ? (
                          <span className="mt-1 block text-supporting text-muted-foreground">
                            {relationship.typeLabel}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="resource-graph-resource">
                        <span className="flex min-w-0 items-center gap-3">
                          {thumbnail ? (
                            <DatasetThumbnailImage
                              alt=""
                              className="size-10 shrink-0 rounded-md border bg-card object-contain"
                              decoding="async"
                              loading="lazy"
                              thumbnail={thumbnail}
                            />
                          ) : null}
                          <ResourcePreviewLink
                            className="group/resource min-w-0 flex-1"
                            mfid={node.unique_id}
                            resourceKind={node.kind}
                            resourceName={node.name}
                          >
                            <ResourceIdentity
                              context={node.context}
                              interactive
                              kind={node.kind}
                              name={node.name}
                              presentation="collection"
                            />
                          </ResourcePreviewLink>
                        </span>
                      </TableCell>
                      <TableCell className="resource-graph-action">
                        <span className="flex justify-end gap-1">
                          <GraphExpansionAction
                            availableModes={expansionModesByNode.get(
                              node.unique_id
                            )}
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
            {hasMoreRows ? (
              <div className="flex justify-center border-t p-3">
                <Button
                  onClick={() =>
                    setVisibleCount((current) =>
                      Math.min(nodes.length, current + GRAPH_TABLE_ROW_BATCH)
                    )
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Show more
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
      {thumbnailQuery.isError ? (
        <p
          className="border-t px-4 py-3 text-body text-muted-foreground"
          role="alert"
        >
          Thumbnail previews could not be loaded.
        </p>
      ) : null}
    </Card>
  )
}

function GraphExpansionAction({
  availableModes,
  expansionStates,
  node,
  onExpand,
}: {
  availableModes?: readonly GraphExpansionMode[]
  expansionStates: ReadonlyMap<string, GraphExpansionState>
  node: WorkspaceResourceGraphNode
  onExpand: (nodeMfid: string, mode: GraphExpansionMode) => void
}) {
  if (!graphNodeCanExpand(node, expansionStates, availableModes)) return null
  const pending = graphExpansionModesForNode(
    node,
    expansionStates,
    availableModes
  ).some((mode) =>
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
            availableModes={availableModes}
            expansionStates={expansionStates}
            node={node}
            onExpand={onExpand}
          />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function graphRelationshipPresentations(graph: WorkspaceResourceGraph) {
  const relationships = new Map<
    string,
    {
      label: string
      relationship: "associated" | "child" | "parent"
      typeLabel: string | null
    }
  >()
  for (const edge of graph.edges) {
    const relatedMfid =
      edge.source === graph.rootMfid
        ? edge.target
        : edge.target === graph.rootMfid
          ? edge.source
          : undefined
    if (!relatedMfid) continue
    const label =
      edge.relationship === "associated"
        ? "Associated"
        : edge.target === graph.rootMfid
          ? "Parent"
          : "Child"
    const relationship = edge.target === graph.rootMfid ? "parent" : "child"
    relationships.set(relatedMfid, {
      label,
      relationship:
        edge.relationship === "associated" ? "associated" : relationship,
      typeLabel:
        edge.relationship === "parent" && edge.relationshipType
          ? workspaceRelationshipTypeLabel({
              relationship,
              relationship_type: edge.relationshipType,
            })
          : null,
    })
  }
  return relationships
}

function graphRelationshipOrder(
  presentation: { relationship: "associated" | "child" | "parent" } | undefined
) {
  if (presentation?.relationship === "parent") return 0
  if (presentation?.relationship === "child") return 1
  if (presentation?.relationship === "associated") return 2
  return 3
}

function useNearViewport(element: RefObject<HTMLElement | null>) {
  const [nearViewport, setNearViewport] = useState(false)
  useEffect(() => {
    const current = element.current
    if (!current || nearViewport) return
    if (typeof IntersectionObserver === "undefined") {
      setNearViewport(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setNearViewport(true)
        observer.disconnect()
      },
      { rootMargin: "320px" }
    )
    observer.observe(current)
    return () => observer.disconnect()
  }, [element, nearViewport])
  return nearViewport
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
