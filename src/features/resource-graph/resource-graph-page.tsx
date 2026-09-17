import { useEffect, useMemo, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import cytoscape from "cytoscape"
import type { Core, ElementDefinition, StylesheetJson } from "cytoscape"

import {
  ExploreGraphFocusIcon,
  FitGraphIcon,
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
import type {
  WorkspaceDatasetThumbnail,
  WorkspaceResourceGraph,
  WorkspaceResourceGraphNode,
} from "@/data/crucible/workspace-source"
import { buildResourceGraphLayout } from "./resource-graph-layout"
import type { ResourceGraphLayoutMetrics } from "./resource-graph-layout"
import { useResourceWorkspaceResource } from "@/features/resource-detail/resource-detail-page"

type GraphLabelMetrics = {
  maxWidth: number
  measure: (value: string) => number
}

export function ResourceGraphPage({
  resourceKind,
  resourceMfid,
}: {
  resourceKind: "dataset" | "sample"
  resourceMfid: string
}) {
  const scope = useWorkspaceScope()
  const navigation = useResourcePreviewContext()
  const resource = useResourceWorkspaceResource()
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
    return items.length
      ? [staticResourceSiblingCollection(items, "Graph relationships")]
      : []
  }, [query.data])
  useRegisterResourceSiblings(previewSiblingCollections)

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
    <div aria-label="Loading resource graph" role="status">
      <Skeleton className="min-h-graph-canvas w-full" />
    </div>
  )
}

function ResourceGraphCanvas({
  graph,
  instanceRef,
  onInspect,
  rootContext,
}: {
  graph: WorkspaceResourceGraph
  instanceRef: React.MutableRefObject<Core | null>
  onInspect: (mfid: string, trigger: HTMLElement) => void
  rootContext: string | null
}) {
  const container = useRef<HTMLDivElement>(null)
  const inspect = useRef(onInspect)
  inspect.current = onInspect

  useEffect(() => {
    const element = container.current
    if (!element) return
    const layout = buildResourceGraphLayout(graph, graphLayoutMetrics(element))
    const labelMetrics = graphLabelMetrics(element)
    const instance = cytoscape({
      boxSelectionEnabled: false,
      container: element,
      elements: graphElements(
        graph,
        layout.positions,
        rootContext,
        labelMetrics
      ),
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
    instance.on("tap", "node", (event) => {
      const mfid = event.target.data("id")
      if (typeof mfid === "string" && mfid !== graph.rootMfid) {
        inspect.current(mfid, element)
      }
    })
    instance.on("mouseover", "node", (event) => {
      element.dataset.nodeHover = ""
      const focus = event.target.closedNeighborhood()
      instance.elements().addClass("graph-muted")
      focus.removeClass("graph-muted")
      event.target.addClass("graph-hovered")
      focus.edges().addClass("graph-highlighted")
    })
    instance.on("mouseout", "node", (event) => {
      delete element.dataset.nodeHover
      event.target.removeClass("graph-hovered")
      instance.elements().removeClass("graph-muted graph-highlighted")
    })
    instance.on("dragpan scrollzoom pinchzoom", () => {
      instance.scratch("resourceGraphViewportChanged", true)
    })
    const animationFrame = requestAnimationFrame(() => {
      centerCurrentResource(instance)
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
      cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      themeObserver.disconnect()
      instance.destroy()
      if (instanceRef.current === instance) instanceRef.current = null
    }
  }, [graph, instanceRef, rootContext])

  return (
    <div className="resource-graph-surface relative overflow-hidden rounded-xl border bg-card">
      <div className="resource-graph-summary absolute top-3 left-3 flex flex-wrap gap-2">
        <Badge variant="outline">{graph.nodes.length} resources</Badge>
        <Badge variant="outline">
          {graph.edges.length}{" "}
          {graph.edges.length === 1 ? "relationship" : "relationships"}
        </Badge>
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
              instance.elements(),
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
          The current resource is centered. Parents are placed to its left,
          children to its right, associated samples above, and associated
          datasets below. The relationship table following the graph provides
          the same resources with keyboard-accessible inspection and navigation.
        </span>
      </div>
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
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="resource-graph-edge-key"
          data-relationship="lineage"
        />
        Parent to child
      </span>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="resource-graph-edge-key"
          data-relationship="associated"
        />
        Associated
      </span>
    </div>
  )
}

function graphElements(
  graph: WorkspaceResourceGraph,
  positions: Readonly<Record<string, { x: number; y: number }>>,
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
      position: positions[node.unique_id],
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
        "curve-style": "straight",
        "line-color": token("--graph-edge"),
        "target-arrow-color": token("--graph-edge"),
        "target-arrow-shape": "triangle",
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

function graphLayoutMetrics(element: HTMLElement): ResourceGraphLayoutMetrics {
  return {
    associationColumnGap: graphNumberToken(
      element,
      "--graph-layout-association-column-gap"
    ),
    associationGap: graphNumberToken(element, "--graph-layout-association-gap"),
    associationRowGap: graphNumberToken(
      element,
      "--graph-layout-association-row-gap"
    ),
    columnGap: graphNumberToken(element, "--graph-layout-column-gap"),
    nodeGap: graphNumberToken(element, "--graph-layout-node-gap"),
    nodeHeight: graphNumberToken(element, "--graph-node-height"),
    nodeWidth: graphNumberToken(element, "--graph-node-width"),
    rowGap: graphNumberToken(element, "--graph-layout-row-gap"),
    rootNodeHeight: graphNumberToken(element, "--graph-root-node-height"),
    rootNodeWidth: graphNumberToken(element, "--graph-root-node-width"),
  }
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
  const bounds = instance.elements().boundingBox({
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
  instance.scratch("resourceGraphViewportChanged", false)
  instance.zoom(Math.max(zoom, instance.minZoom()))
  instance.center(root)
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
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nodes.map((node) => {
                  const thumbnail = thumbnails[node.unique_id]
                  return (
                    <TableRow key={node.unique_id}>
                      <TableCell
                        className="resource-graph-relationship"
                        data-label="Relationship"
                      >
                        <Badge variant="outline">
                          {relationshipLabel(graph, node)}
                        </Badge>
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
                      <TableCell className="resource-graph-action text-right">
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
      </CardContent>
    </Card>
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
