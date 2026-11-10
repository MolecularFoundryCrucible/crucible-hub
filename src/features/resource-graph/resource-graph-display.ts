import { z } from "zod"

import type { WorkspaceResourceGraph } from "@/data/crucible/workspace-source"

const graphOrientations = ["horizontal", "vertical"] as const

export type GraphOrientation = (typeof graphOrientations)[number]

const graphResourceKinds = ["sample", "dataset"] as const
export const graphLineageTypes = [
  "is_derived_from",
  "is_part_of",
  "unspecified",
] as const
const graphHiddenValues = [...graphResourceKinds, ...graphLineageTypes] as const

export type GraphResourceKind = (typeof graphResourceKinds)[number]
export type GraphLineageType = (typeof graphLineageTypes)[number]
export type GraphHiddenValue = (typeof graphHiddenValues)[number]

export type ResourceGraphDisplay = {
  associations: boolean
  hidden: readonly GraphHiddenValue[]
  orientation: GraphOrientation
  thumbnails: boolean
}

const resourceGraphDisplayDefaults = {
  associations: true,
  hidden: [],
  orientation: "vertical",
  thumbnails: true,
} satisfies ResourceGraphDisplay

export const resourceGraphDisplaySearchSchema = z.object({
  associations: z.boolean().optional().catch(undefined),
  hide: z
    .array(z.enum(graphHiddenValues))
    .max(graphHiddenValues.length)
    .optional()
    .catch(undefined),
  orientation: z.enum(graphOrientations).optional().catch(undefined),
  thumbnails: z.boolean().optional().catch(undefined),
})

export function resolveResourceGraphDisplay(search: {
  associations?: boolean
  hide?: readonly GraphHiddenValue[]
  orientation?: GraphOrientation
  thumbnails?: boolean
}): ResourceGraphDisplay {
  return {
    associations:
      search.associations ?? resourceGraphDisplayDefaults.associations,
    hidden: graphHiddenValues.filter((value) => search.hide?.includes(value)),
    orientation: search.orientation ?? resourceGraphDisplayDefaults.orientation,
    thumbnails: search.thumbnails ?? resourceGraphDisplayDefaults.thumbnails,
  }
}

export function activeGraphFilterCount(display: ResourceGraphDisplay) {
  return display.hidden.length + (display.associations ? 0 : 1)
}

export function resourceGraphDisplaySearchPatch(
  changes: Partial<ResourceGraphDisplay>
) {
  return {
    ...(changes.associations === undefined
      ? {}
      : {
          associations:
            changes.associations === resourceGraphDisplayDefaults.associations
              ? undefined
              : changes.associations,
        }),
    ...(changes.hidden === undefined
      ? {}
      : {
          hide: changes.hidden.length
            ? graphHiddenValues.filter((value) =>
                changes.hidden?.includes(value)
              )
            : undefined,
        }),
    ...(changes.orientation === undefined
      ? {}
      : {
          orientation:
            changes.orientation === resourceGraphDisplayDefaults.orientation
              ? undefined
              : changes.orientation,
        }),
    ...(changes.thumbnails === undefined
      ? {}
      : {
          thumbnails:
            changes.thumbnails === resourceGraphDisplayDefaults.thumbnails
              ? undefined
              : changes.thumbnails,
        }),
  }
}

/**
 * Applies the filters, then keeps what still connects to the current
 * resource through shown resources and relationships.
 */
export function filterResourceGraph(
  graph: WorkspaceResourceGraph,
  display: Pick<ResourceGraphDisplay, "associations" | "hidden">
): { graph: WorkspaceResourceGraph; hiddenCount: number } {
  if (display.associations && display.hidden.length === 0) {
    return { graph, hiddenCount: 0 }
  }
  const hidden = new Set<string>(display.hidden)
  const shownNodes = new Set(
    graph.nodes
      .filter(
        (node) => node.unique_id === graph.rootMfid || !hidden.has(node.kind)
      )
      .map((node) => node.unique_id)
  )
  const edges = graph.edges.filter(
    (edge) =>
      shownNodes.has(edge.source) &&
      shownNodes.has(edge.target) &&
      (edge.relationship === "associated"
        ? display.associations
        : !hidden.has(edge.relationshipType ?? "unspecified"))
  )
  const neighbours = new Map<string, string[]>()
  const link = (from: string, to: string) => {
    const list = neighbours.get(from)
    if (list) list.push(to)
    else neighbours.set(from, [to])
  }
  for (const edge of edges) {
    link(edge.source, edge.target)
    link(edge.target, edge.source)
  }
  const connected = new Set([graph.rootMfid])
  const queue = [graph.rootMfid]
  for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
    for (const neighbour of neighbours.get(next) ?? []) {
      if (connected.has(neighbour)) continue
      connected.add(neighbour)
      queue.push(neighbour)
    }
  }
  const nodes = graph.nodes.filter((node) => connected.has(node.unique_id))
  return {
    graph: {
      ...graph,
      edges: edges.filter(
        (edge) => connected.has(edge.source) && connected.has(edge.target)
      ),
      nodes,
    },
    hiddenCount: graph.nodes.length - nodes.length,
  }
}
