import { Suspense, useCallback, useMemo, useState } from "react"
import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query"

import { ResourceGraphIcon } from "@/components/crucible/icons"
import { useResourcePreviewContext } from "@/components/crucible/resource-preview-navigation"
import {
  staticResourceSiblingCollection,
  useRegisterResourceSiblings,
} from "@/components/crucible/resource-sibling-navigation"
import { ResourceGraphPending } from "@/components/crucible/resource-tab-state"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
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
} from "@/data/crucible/workspace-source"
import {
  graphExpansionKey,
  graphExpansionModesByNode,
  graphExpansionQuery,
} from "./resource-graph-expansion"
import type {
  GraphExpansionMode,
  GraphExpansionRequest,
  GraphExpansionState,
} from "./resource-graph-expansion"
import { mergeResourceGraphs } from "./resource-graph-merge"
import { graphWithoutAssociations } from "./resource-graph-display"
import type { ResourceGraphDisplay } from "./resource-graph-display"
import { ResourceGraphCanvas } from "./resource-graph-warmup"

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

export type GraphRelationshipPresentation = {
  distance: number
  label: string
  relationship:
    "ancestor" | "associated" | "child" | "descendant" | "indirect" | "parent"
  typeLabel: string | null
}

const initialLineageDepth = 3

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

const emptyGraphThumbnails: Readonly<
  Partial<Record<string, WorkspaceDatasetThumbnail>>
> = {}

function combineGraphThumbnailQueries(
  results: readonly GraphThumbnailQueryResult[]
) {
  const batches = results.flatMap((result) =>
    result.data ? [result.data] : []
  )
  if (batches.length === 0) return emptyGraphThumbnails
  if (batches.length === 1) return batches[0]
  return Object.assign({}, ...batches)
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
    if (expansions.graphs.length === 0) return rootGraph
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
      ? graphData.nodes.map((node) => ({
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
        <Suspense fallback={<ResourceGraphCanvasSkeleton />}>
          <ResourceGraphCanvas
            display={display}
            expansionStates={expansionStates}
            expansionModesByNode={expansionModesByNode}
            graph={canvasGraph ?? displayedGraph}
            inspectedMfid={navigation.preview ?? null}
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
        </Suspense>
      )}

      {expansions.states.some((state) => state.isError) ? (
        <p className="text-body text-destructive" role="alert">
          The graph could not be expanded. Use the retry action beside the
          affected resource.
        </p>
      ) : null}
    </section>
  )
}

function ResourceGraphCanvasSkeleton() {
  return (
    <Skeleton
      aria-label="Loading graph visualization"
      className="min-h-graph-canvas w-full"
    />
  )
}

export function graphRelationshipPresentations(
  graph: WorkspaceResourceGraph
): Map<string, GraphRelationshipPresentation> {
  const relationships = new Map<string, GraphRelationshipPresentation>()
  const upstreamEdgesByTarget = new Map<
    string,
    Array<{ relationshipType: string | null; source: string }>
  >()
  const downstreamEdgesBySource = new Map<
    string,
    Array<{ relationshipType: string | null; target: string }>
  >()
  const neighborsByNode = new Map<
    string,
    Array<{ neighbor: string; relationship: "associated" | "parent" }>
  >()
  const allNodeIds = new Set<string>(graph.nodes.map((node) => node.unique_id))

  const addNeighbor = (
    from: string,
    neighbor: string,
    relationship: "associated" | "parent"
  ) => {
    const list = neighborsByNode.get(from)
    if (list) {
      list.push({ neighbor, relationship })
    } else {
      neighborsByNode.set(from, [{ neighbor, relationship }])
    }
  }

  for (const edge of graph.edges) {
    allNodeIds.add(edge.source)
    allNodeIds.add(edge.target)
    addNeighbor(edge.source, edge.target, edge.relationship)
    addNeighbor(edge.target, edge.source, edge.relationship)
    if (edge.relationship === "parent") {
      const upstream = upstreamEdgesByTarget.get(edge.target)
      if (upstream) {
        upstream.push({
          relationshipType: edge.relationshipType,
          source: edge.source,
        })
      } else {
        upstreamEdgesByTarget.set(edge.target, [
          { relationshipType: edge.relationshipType, source: edge.source },
        ])
      }
      const downstream = downstreamEdgesBySource.get(edge.source)
      if (downstream) {
        downstream.push({
          relationshipType: edge.relationshipType,
          target: edge.target,
        })
      } else {
        downstreamEdgesBySource.set(edge.source, [
          { relationshipType: edge.relationshipType, target: edge.target },
        ])
      }
    }
  }

  const upstreamDistances = new Map<
    string,
    { distance: number; relationshipType: string | null }
  >()
  const upstreamQueue: string[] = [graph.rootMfid]
  upstreamDistances.set(graph.rootMfid, {
    distance: 0,
    relationshipType: null,
  })
  while (upstreamQueue.length > 0) {
    const current = upstreamQueue.shift()!
    const currentEntry = upstreamDistances.get(current)!
    for (const edge of upstreamEdgesByTarget.get(current) ?? []) {
      if (upstreamDistances.has(edge.source)) continue
      upstreamDistances.set(edge.source, {
        distance: currentEntry.distance + 1,
        relationshipType:
          currentEntry.distance === 0 ? edge.relationshipType : null,
      })
      upstreamQueue.push(edge.source)
    }
  }

  const downstreamDistances = new Map<
    string,
    { distance: number; relationshipType: string | null }
  >()
  const downstreamQueue: string[] = [graph.rootMfid]
  downstreamDistances.set(graph.rootMfid, {
    distance: 0,
    relationshipType: null,
  })
  while (downstreamQueue.length > 0) {
    const current = downstreamQueue.shift()!
    const currentEntry = downstreamDistances.get(current)!
    for (const edge of downstreamEdgesBySource.get(current) ?? []) {
      if (downstreamDistances.has(edge.target)) continue
      downstreamDistances.set(edge.target, {
        distance: currentEntry.distance + 1,
        relationshipType:
          currentEntry.distance === 0 ? edge.relationshipType : null,
      })
      downstreamQueue.push(edge.target)
    }
  }

  const directAssociatedMfids = new Set<string>()
  for (const edge of graph.edges) {
    if (edge.relationship !== "associated") continue
    if (edge.source === graph.rootMfid) {
      directAssociatedMfids.add(edge.target)
    } else if (edge.target === graph.rootMfid) {
      directAssociatedMfids.add(edge.source)
    }
  }

  const generalDistances = new Map<
    string,
    { distance: number; hasAssociation: boolean }
  >()
  const generalQueue: string[] = [graph.rootMfid]
  generalDistances.set(graph.rootMfid, {
    distance: 0,
    hasAssociation: false,
  })
  while (generalQueue.length > 0) {
    const current = generalQueue.shift()!
    const currentEntry = generalDistances.get(current)!
    for (const edge of neighborsByNode.get(current) ?? []) {
      if (generalDistances.has(edge.neighbor)) continue
      generalDistances.set(edge.neighbor, {
        distance: currentEntry.distance + 1,
        hasAssociation:
          currentEntry.hasAssociation || edge.relationship === "associated",
      })
      generalQueue.push(edge.neighbor)
    }
  }

  for (const nodeMfid of allNodeIds) {
    if (nodeMfid === graph.rootMfid) continue
    const upstream = upstreamDistances.get(nodeMfid)
    const downstream = downstreamDistances.get(nodeMfid)

    if (upstream && upstream.distance === 1) {
      relationships.set(nodeMfid, {
        distance: 1,
        label: "Parent",
        relationship: "parent",
        typeLabel: upstream.relationshipType
          ? workspaceRelationshipTypeLabel({
              relationship: "parent",
              relationship_type: upstream.relationshipType,
            })
          : null,
      })
      continue
    }
    if (downstream && downstream.distance === 1) {
      relationships.set(nodeMfid, {
        distance: 1,
        label: "Child",
        relationship: "child",
        typeLabel: downstream.relationshipType
          ? workspaceRelationshipTypeLabel({
              relationship: "child",
              relationship_type: downstream.relationshipType,
            })
          : null,
      })
      continue
    }
    if (directAssociatedMfids.has(nodeMfid)) {
      relationships.set(nodeMfid, {
        distance: 1,
        label: "Associated",
        relationship: "associated",
        typeLabel: null,
      })
      continue
    }
    if (upstream && (!downstream || upstream.distance <= downstream.distance)) {
      relationships.set(nodeMfid, {
        distance: upstream.distance,
        label: "Ancestor",
        relationship: "ancestor",
        typeLabel: `${upstream.distance} hops upstream`,
      })
      continue
    }
    if (downstream) {
      relationships.set(nodeMfid, {
        distance: downstream.distance,
        label: "Descendant",
        relationship: "descendant",
        typeLabel: `${downstream.distance} hops downstream`,
      })
      continue
    }
    const general = generalDistances.get(nodeMfid)
    if (general && general.hasAssociation) {
      relationships.set(nodeMfid, {
        distance: general.distance,
        label: "Associated",
        relationship: "associated",
        typeLabel:
          general.distance > 1 ? `${general.distance} hops away` : null,
      })
      continue
    }
    relationships.set(nodeMfid, {
      distance: general?.distance ?? 2,
      label: "Indirect",
      relationship: "indirect",
      typeLabel:
        general && general.distance > 1
          ? `${general.distance} hops away`
          : null,
    })
  }

  return relationships
}

export function graphRelationshipOrder(
  presentation:
    Pick<GraphRelationshipPresentation, "distance" | "relationship"> | undefined
) {
  if (!presentation) return 6
  const hopOffset = Math.max(presentation.distance - 1, 0) * 0.01
  if (presentation.relationship === "parent") return 0
  if (presentation.relationship === "ancestor") return 1 + hopOffset
  if (presentation.relationship === "child") return 2
  if (presentation.relationship === "descendant") return 3 + hopOffset
  if (presentation.relationship === "associated") return 4 + hopOffset
  return 5 + hopOffset
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
