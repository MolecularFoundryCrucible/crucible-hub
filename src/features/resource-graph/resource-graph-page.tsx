import { useMemo, useState } from "react"
import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query"
import { z } from "zod"

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
import { useResourceWorkspaceResource } from "@/features/resource-detail/resource-detail-page"
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
  ResourceGraphDepth,
} from "./resource-graph-expansion"
import { mergeResourceGraphs } from "./resource-graph-merge"

type GraphExpansionQueryResult = {
  data?: WorkspaceResourceGraph
  isError: boolean
  isFetching: boolean
  isPending: boolean
  isSuccess: boolean
  refetch: () => Promise<unknown>
}

export const resourceGraphSearchSchema = z.object({
  depth: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .optional()
    .catch(undefined),
})

export type { ResourceGraphDepth } from "./resource-graph-expansion"

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
      direction: depth === 1 ? "both" : "upstream",
      relationshipKinds: depth === 1 ? undefined : ["lineage"],
    }),
    placeholderData: keepPreviousData,
  })
  const descendantQuery = useQuery({
    ...resourceGraphQueryOptions(scope, resourceMfid, {
      depth,
      direction: "downstream",
      relationshipKinds: ["lineage"],
    }),
    enabled: depth > 1,
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
    if (depth === 1) return query.data
    if (descendantQuery.isPlaceholderData) {
      return query.data ?? descendantQuery.data
    }
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
    depth,
    descendantQuery.data,
    descendantQuery.isPlaceholderData,
    query.data,
  ])
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
  const expansionModesByNode = useMemo(
    () =>
      displayedGraph
        ? graphExpansionModesByNode(displayedGraph)
        : new Map<string, readonly GraphExpansionMode[]>(),
    [displayedGraph]
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

  if (
    !displayedGraph &&
    (query.isPending ||
      (depth > 1 && (descendantQuery.isPending || associationQuery.isPending)))
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
            if (depth > 1) {
              void descendantQuery.refetch()
              void associationQuery.refetch()
            }
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
      aria-busy={
        query.isFetching ||
        descendantQuery.isFetching ||
        associationQuery.isFetching ||
        isExpanding
      }
      aria-label="Resource graph"
      className="flex min-w-0 flex-col gap-4"
    >
      {query.isError || (depth > 1 && descendantQuery.isError) ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3"
          role="alert"
        >
          <p className="text-body text-muted-foreground">
            {depth > 1
              ? "Some lineage directions could not be refreshed. Showing the available paths."
              : "The graph could not be refreshed. Showing the last available data."}
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
          expansionMenu={
            <GraphExpansionMenu
              expansionModesByNode={expansionModesByNode}
              expansionStates={expansionStates}
              nodes={relatedNodes}
              onExpand={expandNode}
            />
          }
          expansionStates={expansionStates}
          expansionModesByNode={expansionModesByNode}
          graph={displayedGraph}
          loading={
            query.isFetching ||
            descendantQuery.isFetching ||
            associationQuery.isFetching ||
            isExpanding
          }
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
        expansionModesByNode={expansionModesByNode}
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

function GraphExpansionMenu({
  expansionModesByNode,
  expansionStates,
  nodes,
  onExpand,
}: {
  expansionModesByNode: ReadonlyMap<string, readonly GraphExpansionMode[]>
  expansionStates: ReadonlyMap<string, GraphExpansionState>
  nodes: readonly WorkspaceResourceGraphNode[]
  onExpand: (nodeMfid: string, mode: GraphExpansionMode) => void
}) {
  const expandableNodes = nodes.filter((node) =>
    graphNodeCanExpand(
      node,
      expansionStates,
      expansionModesByNode.get(node.unique_id)
    )
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
                  availableModes={expansionModesByNode.get(node.unique_id)}
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
  thumbnails,
}: {
  expansionModesByNode: ReadonlyMap<string, readonly GraphExpansionMode[]>
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
          </div>
        )}
      </CardContent>
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
