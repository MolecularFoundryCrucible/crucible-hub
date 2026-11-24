import "@tanstack/react-start/server-only"

import { z } from "zod"
import type { components } from "@/generated/crucible-api"
import { demoWorkspace } from "@/data/crucible/fixtures/demo-workspace"
import { CrucibleResponseError } from "@/server/crucible/request-error.server"
import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import { normalizeScientificMetadata } from "./scientific-metadata"
import { workspacePersonSchema } from "./people.schema"
import type { FixtureScenario } from "./fixture-scenarios"
import type { WorkspacePrivilegeMode } from "./privilege-mode"
import type {
  WorkspaceDatasetDescriptiveUpdate,
  WorkspaceDeletionRequest,
  WorkspaceLinkedResource,
  WorkspacePerson,
  WorkspaceResourceDetail,
  WorkspaceSampleDescriptiveUpdate,
  WorkspaceScientificMetadataUpdate,
  WorkspaceScientificMetadataWrite,
} from "./workspace-source"

type Schema<TSchemaName extends keyof components["schemas"]> =
  components["schemas"][TSchemaName]

type ApiResource =
  | Schema<"DatasetResponse">
  | Schema<"InstrumentResponse">
  | Schema<"ProjectWithLead">
  | Schema<"SampleResponse">

export type WorkspaceRelationshipResourceDetail = Extract<
  WorkspaceResourceDetail,
  { kind: "sample" | "dataset" }
>

export const apiProjectReferenceSchema = z
  .object({
    project_id: z.string().max(10_000),
    title: z.string().max(10_000).nullable().optional(),
    unique_id: z.string().min(1).max(255),
  })
  .passthrough()

export const apiInstrumentReferenceSchema = z
  .object({
    instrument_id: z.string().max(10_000).nullable().optional(),
    instrument_name: z.string().max(10_000),
    unique_id: z.string().min(1).max(255),
  })
  .passthrough()

const workspaceDeletionRequestSchema = z
  .object({
    capabilities: z
      .object({ can_review: z.boolean() })
      .optional()
      .default({ can_review: false }),
    id: z.number(),
    project_id: z.string().nullable().optional(),
    project_mfid: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
    request_time: z.string().nullable().optional(),
    requester: workspacePersonSchema.nullable().optional().default(null),
    requester_id: z.string(),
    resource_mfid: z.string(),
    resource_name: z.string().nullable().optional(),
    resource_type: z.string().nullable().optional(),
    review_time: z.string().nullable().optional(),
    reviewer: workspacePersonSchema.nullable().optional().default(null),
    reviewer_id: z.string().nullable().optional(),
    reviewer_notes: z.string().nullable().optional(),
    status: z.enum(["pending", "approved", "rejected"]),
  })
  .passthrough()

export function workspaceDeletionRequest(
  value: unknown
): WorkspaceDeletionRequest | null {
  const result = workspaceDeletionRequestSchema.safeParse(value)
  if (!result.success) return null
  return {
    capabilities: result.data.capabilities,
    id: result.data.id,
    project_id: result.data.project_id ?? null,
    project_mfid: result.data.project_mfid ?? null,
    reason: result.data.reason ?? null,
    request_time: result.data.request_time ?? null,
    requester: result.data.requester,
    requester_id: result.data.requester_id,
    resource_mfid: result.data.resource_mfid,
    resource_name: result.data.resource_name ?? null,
    resource_type: result.data.resource_type ?? null,
    review_time: result.data.review_time ?? null,
    reviewer: result.data.reviewer,
    reviewer_id: result.data.reviewer_id ?? null,
    reviewer_notes: result.data.reviewer_notes ?? null,
    status: result.data.status,
  }
}

function isDataset(
  resource: ApiResource
): resource is Schema<"DatasetResponse"> {
  return "dataset_name" in resource
}

function isSample(resource: ApiResource): resource is Schema<"SampleResponse"> {
  return "sample_name" in resource
}

function isInstrument(
  resource: ApiResource
): resource is Schema<"InstrumentResponse"> {
  return "location" in resource
}

export function safeOwner(value: unknown): WorkspacePerson | null {
  if (typeof value !== "object" || value === null) return null
  const owner = value as Record<string, unknown>
  if (
    typeof owner.unique_id !== "string" ||
    typeof owner.first_name !== "string" ||
    typeof owner.last_name !== "string" ||
    (typeof owner.is_service_account !== "boolean" &&
      owner.is_service_account != null) ||
    (typeof owner.username !== "string" && owner.username != null)
  ) {
    return null
  }
  return {
    unique_id: owner.unique_id,
    first_name: owner.first_name,
    is_service_account: owner.is_service_account === true,
    last_name: owner.last_name,
    username: owner.username ?? null,
  }
}

function commonResource(
  resource: ApiResource,
  kind: WorkspaceResourceDetail["kind"],
  name: string,
  owner: unknown
) {
  return {
    unique_id: resource.unique_id,
    kind,
    name,
    capabilities: resource.capabilities ?? null,
    owner: safeOwner(owner),
    role: "role" in resource ? (resource.role ?? null) : null,
    creation_time: resource.creation_time ?? null,
    modification_time: resource.modification_time ?? null,
    scientific_metadata: normalizeScientificMetadata(
      resource.scientific_metadata
    ),
  }
}

function workspaceLinks(
  links: readonly Schema<"LinkedResource">[] | null | undefined
): readonly WorkspaceLinkedResource[] | null {
  if (links == null) return null
  return links.map((link) => ({
    name: link.name ?? null,
    relationship: workspaceRelationship(link.direction),
    relationship_type: link.relationship_type ?? null,
    resource_type: link.resource_type,
    unique_id: link.unique_id,
  }))
}

function workspaceRelationship(
  direction: Schema<"LinkedResource">["direction"]
): WorkspaceLinkedResource["relationship"] {
  switch (direction) {
    case "source":
      return "parent"
    case "target":
      return "child"
    case "undirected":
      return "associated"
    default:
      throw new Error("The resource relationship direction is invalid.")
  }
}

export function toWorkspaceResourceDetail(
  resource: ApiResource
): WorkspaceResourceDetail {
  if (isDataset(resource)) {
    return {
      ...commonResource(
        resource,
        "dataset",
        resource.dataset_name ?? "",
        resource.owner
      ),
      kind: "dataset",
      deletion_request: workspaceDeletionRequest(resource.deletion_request),
      public: resource.public,
      project: resource.project ?? null,
      project_id: resource.project?.project_id ?? resource.project_id ?? null,
      instrument: resource.instrument ?? null,
      instrument_id:
        resource.instrument?.instrument_id ?? resource.instrument_id ?? null,
      measurement: resource.measurement ?? null,
      data_format: resource.data_format ?? null,
      data_type: resource.data_type ?? null,
      session_name: resource.session_name ?? null,
      size: resource.size ?? null,
      timestamp: resource.timestamp ?? null,
      links: workspaceLinks(resource.links),
    }
  }
  if (isSample(resource)) {
    return {
      ...commonResource(
        resource,
        "sample",
        resource.sample_name,
        resource.owner
      ),
      kind: "sample",
      deletion_request: workspaceDeletionRequest(resource.deletion_request),
      public: resource.public,
      project: resource.project ?? null,
      project_id: resource.project?.project_id ?? resource.project_id ?? null,
      description: resource.description ?? null,
      sample_type: resource.sample_type ?? null,
      timestamp: resource.timestamp ?? null,
      links: workspaceLinks(resource.links),
    }
  }
  if (isInstrument(resource)) {
    return {
      ...commonResource(
        resource,
        "instrument",
        resource.instrument_name,
        resource.owner
      ),
      kind: "instrument",
      description: resource.description ?? null,
      instrument_id: resource.instrument_id ?? null,
      instrument_type: resource.instrument_type ?? null,
      location: resource.location,
      manufacturer: resource.manufacturer ?? null,
      model: resource.model ?? null,
      other_id: resource.other_id ?? null,
      other_id_source: resource.other_id_source ?? null,
      status: resource.status ?? null,
    }
  }
  return {
    ...commonResource(
      resource,
      "project",
      resource.title ?? resource.project_id,
      resource.owner
    ),
    kind: "project",
    project_id: resource.project_id,
    organization: resource.organization,
    status: resource.status ?? null,
  }
}

export function fixtureWorkspace(scenario?: FixtureScenario) {
  const source = readWorkspaceFixture(scenario)
  if (source.status === "unavailable") throw new Error(source.reason)
  return source.workspace
}

export async function readWorkspaceResource(
  resourceMfid: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal,
  projection: "overview" | "summary" = "overview",
  privilegeMode?: WorkspacePrivilegeMode
): Promise<WorkspaceResourceDetail | null> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const workspace = fixtureWorkspace(scenario)
    const dataset = workspace.datasets.find(
      (candidate) => candidate.unique_id === resourceMfid
    )
    if (dataset) {
      const template =
        demoWorkspace.datasets.find(
          (candidate) => candidate.unique_id === resourceMfid
        ) ?? demoWorkspace.datasets[0]
      return toWorkspaceResourceDetail({ ...template, ...dataset })
    }
    const sample = workspace.samples.find(
      (candidate) => candidate.unique_id === resourceMfid
    )
    if (sample) {
      const template =
        demoWorkspace.samples.find(
          (candidate) => candidate.unique_id === resourceMfid
        ) ?? demoWorkspace.samples[0]
      return toWorkspaceResourceDetail({ ...template, ...sample })
    }
    const instrument = workspace.instruments.find(
      (candidate) => candidate.unique_id === resourceMfid
    )
    if (instrument) {
      const template =
        demoWorkspace.instruments.find(
          (candidate) => candidate.unique_id === resourceMfid
        ) ?? demoWorkspace.instruments[0]
      return toWorkspaceResourceDetail({ ...template, ...instrument })
    }
    const project = workspace.projects.find(
      (candidate) => candidate.unique_id === resourceMfid
    )
    if (!project || !("organization" in project)) return null
    const template =
      demoWorkspace.projects.find(
        (candidate) => candidate.unique_id === resourceMfid
      ) ?? demoWorkspace.projects[0]
    if (!("organization" in template)) return null
    const { members, ...projectFields } = project
    return toWorkspaceResourceDetail({
      ...template,
      ...projectFields,
      members:
        members === undefined ? undefined : members ? [...members] : null,
    })
  }

  const client = createCrucibleClient(configuration, { privilegeMode })
  const result = await client.GET("/resources/{mfid}", {
    params: {
      path: { mfid: resourceMfid },
      query: {
        include_datasets: false,
        include_links: projection === "overview",
        include_metadata: projection === "overview",
        include_owner: true,
      },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (result.response.status === 404) return null
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  return toWorkspaceResourceDetail(result.data)
}

type SampleDescriptiveChanges = {
  description?: string | null
  sample_name?: string
  sample_type?: string | null
  timestamp?: string | null
}

function workspaceSampleDescriptiveUpdate(
  sample: WorkspaceSampleDescriptiveUpdate
): WorkspaceSampleDescriptiveUpdate {
  return {
    description: sample.description ?? null,
    modification_time: sample.modification_time ?? null,
    sample_name: sample.sample_name,
    sample_type: sample.sample_type ?? null,
    timestamp: sample.timestamp ?? null,
    unique_id: sample.unique_id,
  }
}

export async function patchWorkspaceSampleDescription(
  resourceMfid: string,
  changes: SampleDescriptiveChanges,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceSampleDescriptiveUpdate> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const sample = fixtureWorkspace(scenario).samples.find(
      (candidate) => candidate.unique_id === resourceMfid
    )
    if (!sample) throw new CrucibleResponseError(404)
    const template =
      demoWorkspace.samples.find(
        (candidate) => candidate.unique_id === resourceMfid
      ) ?? demoWorkspace.samples[0]
    return workspaceSampleDescriptiveUpdate({
      description: template.description ?? null,
      modification_time: sample.modification_time ?? null,
      sample_name: sample.sample_name,
      sample_type: sample.sample_type ?? null,
      timestamp: sample.timestamp ?? null,
      unique_id: sample.unique_id,
      ...changes,
    })
  }

  const client = createCrucibleClient(configuration)
  const result = await client.PATCH("/samples/{sample_mfid}", {
    body: changes,
    params: { path: { sample_mfid: resourceMfid } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  return workspaceSampleDescriptiveUpdate({
    description: result.data.description ?? null,
    modification_time: result.data.modification_time ?? null,
    sample_name: result.data.sample_name,
    sample_type: result.data.sample_type ?? null,
    timestamp: result.data.timestamp ?? null,
    unique_id: result.data.unique_id,
  })
}

type DatasetDescriptiveChanges = {
  data_format?: string | null
  data_type?: string | null
  dataset_name?: string
  measurement?: string | null
  session_name?: string | null
  timestamp?: string | null
}

function workspaceDatasetDescriptiveUpdate(
  dataset: WorkspaceDatasetDescriptiveUpdate
): WorkspaceDatasetDescriptiveUpdate {
  return {
    data_format: dataset.data_format ?? null,
    data_type: dataset.data_type ?? null,
    dataset_name: dataset.dataset_name,
    measurement: dataset.measurement ?? null,
    modification_time: dataset.modification_time ?? null,
    session_name: dataset.session_name ?? null,
    timestamp: dataset.timestamp ?? null,
    unique_id: dataset.unique_id,
  }
}

export async function patchWorkspaceDatasetDescription(
  resourceMfid: string,
  changes: DatasetDescriptiveChanges,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceDatasetDescriptiveUpdate> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const dataset = fixtureWorkspace(scenario).datasets.find(
      (candidate) => candidate.unique_id === resourceMfid
    )
    if (!dataset) throw new CrucibleResponseError(404)
    const template =
      demoWorkspace.datasets.find(
        (candidate) => candidate.unique_id === resourceMfid
      ) ?? demoWorkspace.datasets[0]
    return workspaceDatasetDescriptiveUpdate({
      data_format: template.data_format,
      data_type: template.data_type,
      dataset_name: dataset.dataset_name ?? "",
      measurement: dataset.measurement ?? null,
      modification_time: dataset.modification_time ?? null,
      session_name: template.session_name,
      timestamp: template.timestamp,
      unique_id: dataset.unique_id,
      ...changes,
    })
  }

  const client = createCrucibleClient(configuration)
  const result = await client.PATCH("/datasets/{dataset_mfid}", {
    body: changes,
    params: { path: { dataset_mfid: resourceMfid } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  return workspaceDatasetDescriptiveUpdate({
    data_format: result.data.data_format ?? null,
    data_type: result.data.data_type ?? null,
    dataset_name: result.data.dataset_name ?? "",
    measurement: result.data.measurement ?? null,
    modification_time: result.data.modification_time ?? null,
    session_name: result.data.session_name ?? null,
    timestamp: result.data.timestamp ?? null,
    unique_id: result.data.unique_id,
  })
}

function workspaceScientificMetadataUpdate(
  value: Schema<"ScientificMetadataBinaryRead">
): WorkspaceScientificMetadataUpdate {
  const metadata = normalizeScientificMetadata(value.scientific_metadata)
  if (!metadata) {
    throw new Error("The scientific metadata response is invalid.")
  }
  return {
    scientific_metadata: metadata,
    unique_id: value.unique_id,
  }
}

export async function writeWorkspaceResourceMetadata(
  resourceMfid: string,
  resourceKind: "sample" | "dataset" | "project" | "instrument",
  update: WorkspaceScientificMetadataWrite,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceScientificMetadataUpdate> {
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
    if (!resource && resourceMfid.startsWith(`fixture-${resourceKind}-`)) {
      return { scientific_metadata: update.metadata, unique_id: resourceMfid }
    }
    if (!resource || resource.kind !== resourceKind) {
      throw new CrucibleResponseError(404)
    }
    const current = resource.scientific_metadata ?? {}
    const metadata =
      update.kind === "merge"
        ? { ...current, ...update.metadata }
        : update.metadata
    return {
      scientific_metadata: metadata,
      unique_id: resource.unique_id,
    }
  }

  const client = createCrucibleClient(configuration)
  const result =
    update.kind === "merge"
      ? await client.PATCH("/resources/{mfid}/metadata", {
          body: update.metadata,
          params: { path: { mfid: resourceMfid } },
          signal: crucibleRequestSignal(requestSignal),
        })
      : await client.POST("/resources/{mfid}/metadata", {
          body: update.metadata,
          params: {
            path: { mfid: resourceMfid },
            query: { overwrite: true },
          },
          signal: crucibleRequestSignal(requestSignal),
        })
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  const normalized = workspaceScientificMetadataUpdate(result.data)
  if (normalized.unique_id !== resourceMfid) {
    throw new Error("The scientific metadata response is invalid.")
  }
  return normalized
}
