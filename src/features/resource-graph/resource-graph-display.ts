import { z } from "zod"

import type { WorkspaceResourceGraph } from "@/data/crucible/workspace-source"

export const graphOrientations = ["auto", "horizontal", "vertical"] as const

export type GraphOrientation = (typeof graphOrientations)[number]

export type ResourceGraphDisplay = {
  associations: boolean
  orientation: GraphOrientation
  thumbnails: boolean
}

export const resourceGraphDisplayDefaults = {
  associations: true,
  orientation: "auto",
  thumbnails: false,
} satisfies ResourceGraphDisplay

export const resourceGraphDisplaySearchSchema = z.object({
  associations: z.boolean().optional().catch(undefined),
  orientation: z.enum(graphOrientations).optional().catch(undefined),
  thumbnails: z.boolean().optional().catch(undefined),
})

export function resolveResourceGraphDisplay(search: {
  associations?: boolean
  orientation?: GraphOrientation
  thumbnails?: boolean
}): ResourceGraphDisplay {
  return {
    associations:
      search.associations ?? resourceGraphDisplayDefaults.associations,
    orientation: search.orientation ?? resourceGraphDisplayDefaults.orientation,
    thumbnails: search.thumbnails ?? resourceGraphDisplayDefaults.thumbnails,
  }
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

export function graphWithoutAssociations(
  graph: WorkspaceResourceGraph
): WorkspaceResourceGraph {
  const edges = graph.edges.filter((edge) => edge.relationship === "parent")
  const connected = new Set([graph.rootMfid])
  let changed = true
  while (changed) {
    changed = false
    for (const edge of edges) {
      if (connected.has(edge.source) && !connected.has(edge.target)) {
        connected.add(edge.target)
        changed = true
      }
      if (connected.has(edge.target) && !connected.has(edge.source)) {
        connected.add(edge.source)
        changed = true
      }
    }
  }

  return {
    ...graph,
    edges: edges.filter(
      (edge) => connected.has(edge.source) && connected.has(edge.target)
    ),
    nodes: graph.nodes.filter((node) => connected.has(node.unique_id)),
  }
}
