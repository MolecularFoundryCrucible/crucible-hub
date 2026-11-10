import "@tanstack/react-start/server-only"

import type { components } from "@/generated/crucible-api"

import type {
  Workspace,
  WorkspaceResourceGraph,
  WorkspaceResourceGraphEdge,
  WorkspaceResourceGraphNode,
  WorkspaceResourceGraphRequest,
} from "./workspace-source"

type Schema<TName extends keyof components["schemas"]> =
  components["schemas"][TName]

export type FixtureGraphWorkspace = Pick<
  Workspace,
  "datasets" | "id" | "samples"
>

function fixtureLinks(item: object): readonly Schema<"LinkedResource">[] {
  return "links" in item && Array.isArray(item.links) ? item.links : []
}

function lineageType(value: string | null | undefined): LineageType {
  return value === "is_derived_from" || value === "is_part_of" ? value : null
}

type LineageType = "is_derived_from" | "is_part_of" | null
type FixtureLink =
  | {
      kind: "lineage"
      parent: string
      child: string
      type: LineageType
    }
  | { kind: "association"; sample: string; dataset: string }

const sample = (index: number) => `fixture-sample-${index}`
const dataset = (index: number) => `fixture-dataset-${index}`

// A lineage network for the dense scenario only, so graph work has depth,
// every lineage type and branches beyond the first query to expand.
const denseGraphLinks: readonly FixtureLink[] = [
  {
    kind: "lineage",
    parent: sample(5),
    child: sample(1),
    type: "is_derived_from",
  },
  {
    kind: "lineage",
    parent: sample(10),
    child: sample(5),
    type: "is_derived_from",
  },
  { kind: "lineage", parent: sample(11), child: sample(5), type: "is_part_of" },
  {
    kind: "lineage",
    parent: sample(12),
    child: sample(2),
    type: "is_derived_from",
  },
  { kind: "lineage", parent: sample(30), child: sample(10), type: null },
  { kind: "lineage", parent: sample(3), child: sample(13), type: "is_part_of" },
  { kind: "lineage", parent: sample(3), child: sample(14), type: "is_part_of" },
  {
    kind: "lineage",
    parent: sample(13),
    child: sample(20),
    type: "is_derived_from",
  },
  { kind: "lineage", parent: sample(20), child: sample(21), type: null },
  {
    kind: "lineage",
    parent: sample(21),
    child: sample(22),
    type: "is_derived_from",
  },
  {
    kind: "lineage",
    parent: dataset(1),
    child: dataset(6),
    type: "is_derived_from",
  },
  {
    kind: "lineage",
    parent: dataset(6),
    child: dataset(7),
    type: "is_part_of",
  },
  { kind: "lineage", parent: dataset(2), child: dataset(8), type: null },
  { kind: "association", sample: sample(1), dataset: dataset(2) },
  { kind: "association", sample: sample(3), dataset: dataset(3) },
  { kind: "association", sample: sample(13), dataset: dataset(4) },
  { kind: "association", sample: sample(2), dataset: dataset(5) },
  { kind: "association", sample: sample(20), dataset: dataset(9) },
  { kind: "association", sample: sample(5), dataset: dataset(10) },
]

const extraLinksByWorkspace: Readonly<Record<string, readonly FixtureLink[]>> =
  {
    "dense-workspace": denseGraphLinks,
  }

function linksFromResources(workspace: FixtureGraphWorkspace) {
  const links: FixtureLink[] = []
  const resources = [
    ...workspace.samples.map((item) => ({ item, kind: "sample" as const })),
    ...workspace.datasets.map((item) => ({ item, kind: "dataset" as const })),
  ]
  for (const { item, kind } of resources) {
    for (const link of fixtureLinks(item)) {
      if (link.direction === "source" || link.direction === "target") {
        const parent =
          link.direction === "source" ? link.unique_id : item.unique_id
        const child =
          link.direction === "source" ? item.unique_id : link.unique_id
        links.push({
          kind: "lineage",
          parent,
          child,
          type: lineageType(link.relationship_type),
        })
      } else if (kind !== link.resource_type) {
        links.push({
          kind: "association",
          sample: kind === "sample" ? item.unique_id : link.unique_id,
          dataset: kind === "sample" ? link.unique_id : item.unique_id,
        })
      }
    }
  }
  return links
}

function toEdge(link: FixtureLink): WorkspaceResourceGraphEdge {
  return link.kind === "lineage"
    ? {
        directed: true,
        id: `fixture:lineage:${link.parent}:${link.child}`,
        relationship: "parent",
        relationshipType: link.type,
        source: link.parent,
        target: link.child,
      }
    : {
        directed: false,
        id: `fixture:association:${link.sample}:${link.dataset}`,
        relationship: "associated",
        relationshipType: null,
        source: link.sample,
        target: link.dataset,
      }
}

/**
 * Walks the fixture links the way GET /resources/{mfid}/graph does: up to
 * `depth` selected edges from the root, following lineage in the requested
 * direction and associations either way.
 */
export function fixtureResourceGraph(
  rootMfid: string,
  request: WorkspaceResourceGraphRequest,
  workspace: FixtureGraphWorkspace
): WorkspaceResourceGraph {
  const depth = request.depth ?? 1
  const direction = request.direction ?? "both"
  const kinds = new Set(request.relationshipKinds ?? ["lineage", "association"])
  const types = request.relationshipTypes
    ? new Set(request.relationshipTypes)
    : null

  const resources = new Map<string, WorkspaceResourceGraphNode>()
  for (const item of workspace.samples) {
    resources.set(item.unique_id, {
      context: item.sample_type ?? null,
      dataFormat: null,
      expansionAvailability: {
        ancestors: false,
        associations: false,
        descendants: false,
      },
      hasMoreRelationships: false,
      instrument: null,
      kind: "sample",
      name: item.sample_name || item.unique_id,
      project: item.project ?? null,
      traversalDepth: 0,
      unique_id: item.unique_id,
    })
  }
  for (const item of workspace.datasets) {
    resources.set(item.unique_id, {
      context: item.measurement ?? null,
      dataFormat: item.data_format ?? null,
      expansionAvailability: {
        ancestors: false,
        associations: false,
        descendants: false,
      },
      hasMoreRelationships: false,
      instrument: item.instrument ?? null,
      kind: "dataset",
      name: item.dataset_name || item.unique_id,
      project: item.project ?? null,
      traversalDepth: 0,
      unique_id: item.unique_id,
    })
  }

  const allEdges = new Map<string, WorkspaceResourceGraphEdge>()
  for (const link of [
    ...linksFromResources(workspace),
    ...(extraLinksByWorkspace[workspace.id] ?? []),
  ]) {
    const edge = toEdge(link)
    if (resources.has(edge.source) && resources.has(edge.target)) {
      allEdges.set(edge.id, edge)
    }
  }

  const selected = (edge: WorkspaceResourceGraphEdge) =>
    edge.relationship === "associated"
      ? kinds.has("association")
      : kinds.has("lineage") &&
        (!types || types.has(edge.relationshipType ?? "unspecified"))
  const step = (edge: WorkspaceResourceGraphEdge, from: string) => {
    if (!selected(edge)) return null
    if (edge.relationship === "associated") {
      if (edge.source === from) return edge.target
      return edge.target === from ? edge.source : null
    }
    if (direction !== "downstream" && edge.target === from) return edge.source
    if (direction !== "upstream" && edge.source === from) return edge.target
    return null
  }

  const edgesByNode = new Map<string, WorkspaceResourceGraphEdge[]>()
  for (const edge of allEdges.values()) {
    for (const end of [edge.source, edge.target]) {
      const list = edgesByNode.get(end)
      if (list) list.push(edge)
      else edgesByNode.set(end, [edge])
    }
  }

  const depths = new Map([[rootMfid, 0]])
  const returnedEdges = new Map<string, WorkspaceResourceGraphEdge>()
  let frontier = [rootMfid]
  for (let level = 1; level <= depth && frontier.length; level += 1) {
    const next: string[] = []
    for (const from of frontier) {
      for (const edge of edgesByNode.get(from) ?? []) {
        const to = step(edge, from)
        if (!to) continue
        returnedEdges.set(edge.id, edge)
        if (!depths.has(to)) {
          depths.set(to, level)
          next.push(to)
        }
      }
    }
    frontier = next
  }

  const nodes = [...depths].flatMap(([mfid, traversalDepth]) => {
    const node = resources.get(mfid)
    if (!node) return []
    const pending = (edgesByNode.get(mfid) ?? []).filter(
      (edge) => !returnedEdges.has(edge.id)
    )
    const ancestors = pending.some(
      (edge) => edge.relationship === "parent" && edge.target === mfid
    )
    const descendants = pending.some(
      (edge) => edge.relationship === "parent" && edge.source === mfid
    )
    const associations = pending.some(
      (edge) => edge.relationship === "associated"
    )
    return [
      {
        ...node,
        expansionAvailability: { ancestors, associations, descendants },
        hasMoreRelationships: ancestors || descendants || associations,
        traversalDepth,
      },
    ]
  })

  return {
    edgeLimit: 1_000,
    edges: [...returnedEdges.values()],
    hasMore: false,
    nodeLimit: 500,
    nodes,
    requestedDepth: depth,
    returnedDepth: Math.max(0, ...depths.values()),
    rootMfid,
    truncated: false,
    truncationReasons: [],
  }
}
