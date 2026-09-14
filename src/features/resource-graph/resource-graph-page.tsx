import { useEffect, useMemo, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import cytoscape from "cytoscape"
import type { Core, ElementDefinition, StylesheetJson } from "cytoscape"

import {
  FitGraphIcon,
  ResourceGraphIcon,
  ZoomInGraphIcon,
  ZoomOutGraphIcon,
} from "@/components/crucible/icons"
import { DatasetThumbnailImage } from "@/components/crucible/dataset-thumbnail"
import { ResourceFullPageLink } from "@/components/crucible/resource-full-page-link"
import {
  ResourcePreviewLink,
  staticResourcePreviewSiblingCollection,
  useRegisterResourcePreviewSiblings,
  useResourcePreviewContext,
} from "@/components/crucible/resource-preview-navigation"
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
import type {
  WorkspaceDatasetThumbnail,
  WorkspaceResourceGraph,
  WorkspaceResourceGraphNode,
} from "@/data/crucible/workspace-source"

export function ResourceGraphPage({
  resourceKind,
  resourceMfid,
}: {
  resourceKind: "dataset" | "sample"
  resourceMfid: string
}) {
  const scope = useWorkspaceScope()
  const navigation = useResourcePreviewContext()
  const graph = useRef<Core | null>(null)
  const query = useQuery(resourceGraphQueryOptions(scope, resourceMfid))
  const datasetMfids = query.data
    ? query.data.nodes
        .filter(
          (node) =>
            node.kind === "dataset" && node.unique_id !== query.data.rootMfid
        )
        .slice(0, THUMBNAIL_PREVIEW_BATCH_MAX)
        .map((node) => node.unique_id)
    : []
  const thumbnailQuery = useQuery({
    ...datasetThumbnailPreviewsQueryOptions(scope, datasetMfids),
    enabled: query.isSuccess && datasetMfids.length > 0,
  })
  const previewSiblingCollections = useMemo(() => {
    const graphData = query.data
    const items = graphData
      ? graphData.nodes
          .filter((node) => node.unique_id !== graphData.rootMfid)
          .map((node) => ({
            kind: node.kind,
            mfid: node.unique_id,
            name: node.name,
          }))
      : []
    return items.length ? [staticResourcePreviewSiblingCollection(items)] : []
  }, [query.data])
  useRegisterResourcePreviewSiblings(previewSiblingCollections)

  if (query.isPending) return <ResourceGraphPending />
  if (!query.data) {
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

  const relatedNodes = query.data.nodes.filter(
    (node) => node.unique_id !== query.data.rootMfid
  )

  return (
    <section
      aria-busy={query.isFetching}
      aria-labelledby="resource-graph-heading"
      className="flex min-w-0 flex-col gap-4"
    >
      <ResourceGraphHeader>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{query.data.nodes.length} resources</Badge>
          <Badge variant="outline">
            {query.data.edges.length}{" "}
            {query.data.edges.length === 1 ? "relationship" : "relationships"}
          </Badge>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="Zoom graph out"
                  onClick={() => {
                    const instance = graph.current
                    if (instance) instance.zoom(instance.zoom() / 1.25)
                  }}
                  size="icon-sm"
                  type="button"
                  variant="outline"
                />
              }
            >
              <ZoomOutGraphIcon aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>Zoom graph out</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="Zoom graph in"
                  onClick={() => {
                    const instance = graph.current
                    if (instance) instance.zoom(instance.zoom() * 1.25)
                  }}
                  size="icon-sm"
                  type="button"
                  variant="outline"
                />
              }
            >
              <ZoomInGraphIcon aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>Zoom graph in</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="Fit graph to view"
                  onClick={() => graph.current?.fit()}
                  size="icon-sm"
                  type="button"
                  variant="outline"
                />
              }
            >
              <FitGraphIcon aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>Fit graph to view</TooltipContent>
          </Tooltip>
        </div>
      </ResourceGraphHeader>

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
          graph={query.data}
          instanceRef={graph}
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

      <p className="text-supporting text-muted-foreground">
        Solid arrows show parent and child lineage. Dashed lines show sample and
        dataset associations.
      </p>

      {thumbnailQuery.isError ? (
        <p className="text-body text-muted-foreground" role="alert">
          Thumbnail previews could not be loaded. The graph remains available.
        </p>
      ) : null}

      <ResourceGraphTable
        graph={query.data}
        nodes={relatedNodes}
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
      <ResourceGraphHeader>
        <Skeleton className="h-7 w-32" />
      </ResourceGraphHeader>
      <Skeleton className="min-h-graph-canvas w-full" />
    </div>
  )
}

function ResourceGraphHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-title-section" id="resource-graph-heading">
          Resource graph
        </h2>
        <p className="text-body text-muted-foreground">
          Select a resource to inspect it, then explore from there to traverse
          its immediate relationships.
        </p>
      </div>
      {children}
    </div>
  )
}

function ResourceGraphCanvas({
  graph,
  instanceRef,
  onInspect,
}: {
  graph: WorkspaceResourceGraph
  instanceRef: React.MutableRefObject<Core | null>
  onInspect: (mfid: string, trigger: HTMLElement) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const inspect = useRef(onInspect)
  inspect.current = onInspect

  useEffect(() => {
    const element = container.current
    if (!element) return
    const instance = cytoscape({
      boxSelectionEnabled: false,
      container: element,
      elements: graphElements(graph),
      layout: {
        animate: false,
        circle: false,
        directed: true,
        direction: "rightward",
        fit: true,
        name: "breadthfirst",
        padding: graphNumberToken(element, "--graph-fit-padding"),
        spacingFactor: graphNumberToken(element, "--graph-layout-spacing"),
      },
      maxZoom: graphNumberToken(element, "--graph-max-zoom"),
      minZoom: graphNumberToken(element, "--graph-min-zoom"),
      style: graphStyles(element),
    })
    instanceRef.current = instance
    instance.on("tap", "node", (event) => {
      const mfid = event.target.data("id")
      if (typeof mfid === "string") inspect.current(mfid, element)
    })
    instance.on("mouseover", "node", () => {
      element.dataset.nodeHover = ""
    })
    instance.on("mouseout", "node", () => {
      delete element.dataset.nodeHover
    })
    const resizeObserver = new ResizeObserver(() => instance.resize())
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
      instance.destroy()
      if (instanceRef.current === instance) instanceRef.current = null
    }
  }, [graph, instanceRef])

  return (
    <div
      aria-describedby="resource-graph-instructions"
      aria-label={`Graph of ${graph.nodes.length} resources and ${graph.edges.length} relationships`}
      className="resource-graph-canvas overflow-hidden rounded-xl border bg-card"
      ref={container}
      role="img"
      tabIndex={-1}
    >
      <span className="sr-only" id="resource-graph-instructions">
        The relationship table following the graph provides the same resources
        with keyboard-accessible inspection and navigation.
      </span>
    </div>
  )
}

function graphElements(graph: WorkspaceResourceGraph): ElementDefinition[] {
  return [
    ...graph.nodes.map((node) => ({
      data: {
        id: node.unique_id,
        isRoot: node.unique_id === graph.rootMfid,
        kind: node.kind,
        label: `${node.kind === "sample" ? "Sample" : "Dataset"}\n${node.name}`,
      },
      group: "nodes" as const,
    })),
    ...graph.edges.map((edge, index) => ({
      data: {
        id: `${edge.source}:${edge.target}:${edge.relationship}:${index}`,
        relationship: edge.relationship,
        source: edge.source,
        target: edge.target,
      },
      group: "edges" as const,
    })),
  ]
}

function graphStyles(element: HTMLElement): StylesheetJson {
  const style = getComputedStyle(element)
  const token = (name: string) => style.getPropertyValue(name).trim()
  return [
    {
      selector: "node",
      style: {
        "background-color": token("--graph-card"),
        "border-color": token("--graph-muted-foreground"),
        "border-width": graphNumberToken(element, "--graph-node-border"),
        color: token("--graph-foreground"),
        "font-family": token("--font-sans"),
        "font-size": graphNumberToken(element, "--graph-font-size"),
        height: graphNumberToken(element, "--graph-node-height"),
        label: "data(label)",
        shape: "round-rectangle",
        "text-max-width": `${graphNumberToken(element, "--graph-label-width")}px`,
        "text-valign": "center",
        "text-wrap": "wrap",
        width: graphNumberToken(element, "--graph-node-width"),
      },
    },
    {
      selector: 'node[kind = "sample"]',
      style: { "border-color": token("--graph-resource-sample") },
    },
    {
      selector: 'node[kind = "dataset"]',
      style: { "border-color": token("--graph-resource-dataset") },
    },
    {
      selector: "node[?isRoot]",
      style: {
        "border-width": graphNumberToken(element, "--graph-root-border"),
        "overlay-color": token("--graph-ring"),
        "overlay-opacity": graphNumberToken(
          element,
          "--graph-root-overlay-opacity"
        ),
        "overlay-padding": graphNumberToken(
          element,
          "--graph-root-overlay-padding"
        ),
      },
    },
    {
      selector: "node:selected",
      style: {
        "background-color": token("--graph-accent"),
        "border-color": token("--graph-ring"),
      },
    },
    {
      selector: "edge",
      style: {
        "curve-style": "taxi",
        "line-color": token("--graph-muted-foreground"),
        "target-arrow-color": token("--graph-muted-foreground"),
        "target-arrow-shape": "triangle",
        "taxi-direction": "rightward",
        width: graphNumberToken(element, "--graph-edge-width"),
      },
    },
    {
      selector: 'edge[relationship = "associated"]',
      style: {
        "line-style": "dashed",
        "target-arrow-shape": "none",
      },
    },
  ]
}

function graphNumberToken(element: HTMLElement, name: string) {
  const value = Number(getComputedStyle(element).getPropertyValue(name))
  if (!Number.isFinite(value)) throw new Error(`Invalid graph token: ${name}`)
  return value
}

function ResourceGraphTable({
  graph,
  nodes,
  thumbnails,
}: {
  graph: WorkspaceResourceGraph
  nodes: readonly WorkspaceResourceGraphNode[]
  thumbnails: Readonly<Partial<Record<string, WorkspaceDatasetThumbnail>>>
}) {
  return (
    <details className="rounded-xl border bg-card" open>
      <summary className="cursor-pointer px-4 py-3 text-label">
        Relationship list ({nodes.length})
      </summary>
      {nodes.length === 0 ? (
        <p className="border-t px-4 py-3 text-body text-muted-foreground">
          No immediate relationships are recorded.
        </p>
      ) : (
        <div className="overflow-x-auto border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Relationship</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>
                  <span className="sr-only">Open</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nodes.map((node) => {
                const thumbnail = thumbnails[node.unique_id]
                return (
                  <TableRow key={node.unique_id}>
                    <TableCell>{relationshipLabel(graph, node)}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-3">
                        {thumbnail ? (
                          <DatasetThumbnailImage
                            alt=""
                            className="size-10 shrink-0 rounded-md border bg-card object-contain"
                            thumbnail={thumbnail}
                          />
                        ) : null}
                        <ResourcePreviewLink
                          className="text-label hover:underline"
                          mfid={node.unique_id}
                          resourceKind={node.kind}
                          resourceName={node.name}
                        >
                          {node.name}
                        </ResourcePreviewLink>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <ResourceTypeIcon type={node.kind} />
                        {node.kind === "sample" ? "Sample" : "Dataset"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <ResourceFullPageLink
                        kind={node.kind}
                        mfid={node.unique_id}
                        name={node.name}
                        presentation="table"
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </details>
  )
}

function relationshipLabel(
  graph: WorkspaceResourceGraph,
  node: WorkspaceResourceGraphNode
) {
  const edge = graph.edges.find(
    (candidate) =>
      candidate.source === node.unique_id || candidate.target === node.unique_id
  )
  if (!edge) return "Connected"
  if (edge.relationship === "associated") return "Associated"
  if (edge.target === graph.rootMfid) return "Parent"
  if (edge.source === graph.rootMfid) return "Child"
  return "Lineage"
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
