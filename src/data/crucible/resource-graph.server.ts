import "@tanstack/react-start/server-only"

import { z } from "zod"
import { resourceDisplayName } from "@/lib/resource-name"
import { CrucibleResponseError } from "@/server/crucible/request-error.server"
import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import { fixtureResourceGraph } from "./fixture-resource-graph.server"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import type { FixtureScenario } from "./fixture-scenarios"
import type {
  WorkspaceResourceGraph,
  WorkspaceResourceGraphRequest,
} from "./workspace-source"

import {
  apiProjectReferenceSchema,
  apiInstrumentReferenceSchema,
  readWorkspaceResource,
} from "./resources.server"

const apiGraphExpansionAvailabilitySchema = z
  .object({
    associations: z.boolean(),
    downstream_lineage: z.boolean(),
    upstream_lineage: z.boolean(),
  })
  .passthrough()

const apiResourceGraphNodeBase = {
  expansion_availability: apiGraphExpansionAvailabilitySchema,
  has_more_relationships: z.boolean().nullable(),
  mfid: z.string().min(1).max(255),
  name: z.string().max(10_000).nullable(),
  project: apiProjectReferenceSchema.nullable(),
  traversal_depth: z.number().int().min(0).max(3),
}

const apiResourceGraphNodeSchema = z.discriminatedUnion("resource_type", [
  z
    .object({
      ...apiResourceGraphNodeBase,
      resource_type: z.literal("sample"),
      sample_type: z.string().max(10_000).nullable(),
    })
    .passthrough(),
  z
    .object({
      ...apiResourceGraphNodeBase,
      data_format: z.string().max(10_000).nullable(),
      instrument: apiInstrumentReferenceSchema.nullable(),
      measurement: z.string().max(10_000).nullable(),
      resource_type: z.literal("dataset"),
    })
    .passthrough(),
])

const apiResourceGraphEdgeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      directed: z.literal(true),
      id: z.string().min(1).max(1_000),
      kind: z.literal("lineage"),
      relationship_type: z.enum(["is_derived_from", "is_part_of"]).nullable(),
      source_mfid: z.string().min(1).max(255),
      target_mfid: z.string().min(1).max(255),
    })
    .passthrough(),
  z
    .object({
      directed: z.literal(false),
      id: z.string().min(1).max(1_000),
      kind: z.literal("association"),
      relationship_type: z.null(),
      source_mfid: z.string().min(1).max(255),
      target_mfid: z.string().min(1).max(255),
    })
    .passthrough(),
])

const apiResourceGraphSchema = z
  .object({
    edge_limit: z.number().int().positive().max(5_000),
    edges: z.array(apiResourceGraphEdgeSchema).max(5_000),
    has_more: z.boolean(),
    node_limit: z.number().int().positive().max(1_000),
    nodes: z.array(apiResourceGraphNodeSchema).max(1_000),
    requested_depth: z.number().int().min(0).max(3),
    returned_depth: z.number().int().min(0).max(3),
    root_mfid: z.string().min(1).max(255),
    truncated: z.boolean(),
    truncation_reasons: z.array(z.enum(["node_limit", "edge_limit"])).max(2),
  })
  .passthrough()

function normalizeApiResourceGraph(
  value: unknown,
  rootMfid: string,
  requestedDepth: number
): WorkspaceResourceGraph {
  const result = apiResourceGraphSchema.safeParse(value)
  if (!result.success) {
    throw new Error("The resource graph response is invalid.")
  }
  if (
    result.data.root_mfid !== rootMfid ||
    result.data.requested_depth !== requestedDepth ||
    result.data.returned_depth > result.data.requested_depth ||
    result.data.truncated !== result.data.truncation_reasons.length > 0 ||
    (!result.data.truncated &&
      result.data.nodes.some((node) => node.has_more_relationships === null)) ||
    (!result.data.has_more &&
      result.data.nodes.some((node) => node.has_more_relationships === true))
  ) {
    throw new Error("The resource graph response has invalid bounds.")
  }
  const nodes = new Map(
    result.data.nodes.map((node) => [
      node.mfid,
      {
        context:
          node.resource_type === "sample" ? node.sample_type : node.measurement,
        dataFormat: node.resource_type === "dataset" ? node.data_format : null,
        expansionAvailability: {
          ancestors: node.expansion_availability.upstream_lineage,
          associations: node.expansion_availability.associations,
          descendants: node.expansion_availability.downstream_lineage,
        },
        hasMoreRelationships: node.has_more_relationships,
        instrument: node.resource_type === "dataset" ? node.instrument : null,
        kind: node.resource_type,
        name: resourceDisplayName(node.resource_type, node.name),
        project: node.project,
        traversalDepth: node.traversal_depth,
        unique_id: node.mfid,
      },
    ])
  )
  const root = nodes.get(rootMfid)
  if (
    nodes.size !== result.data.nodes.length ||
    !root ||
    root.traversalDepth !== 0 ||
    Math.max(...[...nodes.values()].map((node) => node.traversalDepth)) !==
      result.data.returned_depth
  ) {
    throw new Error("The resource graph response has invalid nodes.")
  }
  const edgeIds = new Set<string>()
  const edgeKeys = new Set<string>()
  const edges = result.data.edges.map((edge) => {
    const source = nodes.get(edge.source_mfid)
    const target = nodes.get(edge.target_mfid)
    if (
      !source ||
      !target ||
      edge.source_mfid === edge.target_mfid ||
      (edge.kind === "association" &&
        (source.kind !== "sample" || target.kind !== "dataset")) ||
      (edge.kind === "lineage" && source.kind !== target.kind)
    ) {
      throw new Error("The resource graph response has an invalid edge.")
    }
    const edgeKey = `${edge.kind}\u0000${edge.source_mfid}\u0000${edge.target_mfid}`
    if (edgeIds.has(edge.id) || edgeKeys.has(edgeKey)) {
      throw new Error("The resource graph response has duplicate edges.")
    }
    edgeIds.add(edge.id)
    edgeKeys.add(edgeKey)
    return {
      directed: edge.directed,
      id: edge.id,
      relationship:
        edge.kind === "lineage" ? ("parent" as const) : ("associated" as const),
      relationshipType: edge.relationship_type,
      source: edge.source_mfid,
      target: edge.target_mfid,
    }
  })
  return {
    edgeLimit: result.data.edge_limit,
    edges,
    hasMore: result.data.has_more,
    nodeLimit: result.data.node_limit,
    nodes: [...nodes.values()],
    requestedDepth: result.data.requested_depth,
    returnedDepth: result.data.returned_depth,
    rootMfid,
    truncated: result.data.truncated,
    truncationReasons: result.data.truncation_reasons,
  }
}

export async function readWorkspaceResourceGraph(
  resourceMfid: string,
  graphRequest: WorkspaceResourceGraphRequest = {},
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceResourceGraph> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const resource = await readWorkspaceResource(
      resourceMfid,
      scenario,
      requestSignal
    )
    if (
      !resource ||
      (resource.kind !== "dataset" && resource.kind !== "sample")
    ) {
      throw new CrucibleResponseError(404)
    }
    const fixture = readWorkspaceFixture(scenario)
    if (fixture.status === "unavailable") throw new Error(fixture.reason)
    return fixtureResourceGraph(
      resource.unique_id,
      graphRequest,
      fixture.workspace
    )
  }

  const client = createCrucibleClient(configuration)
  const result = await client.GET("/resources/{resource_mfid}/graph", {
    params: {
      path: { resource_mfid: resourceMfid },
      query: {
        depth: graphRequest.depth ?? 1,
        direction: graphRequest.direction ?? "both",
        relationship_kind: graphRequest.relationshipKinds
          ? [...graphRequest.relationshipKinds]
          : undefined,
        relationship_type: graphRequest.relationshipTypes
          ? [...graphRequest.relationshipTypes]
          : undefined,
      },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data)
    throw new CrucibleResponseError(result.response, result.error)
  return normalizeApiResourceGraph(
    result.data,
    resourceMfid,
    graphRequest.depth ?? 1
  )
}
