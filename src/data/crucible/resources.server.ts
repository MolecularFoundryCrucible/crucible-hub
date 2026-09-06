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
import {
  inverseWorkspaceRelationship,
  workspaceApiRelationshipOperation,
} from "./resource-relationships"
import type { FixtureScenario } from "./fixture-scenarios"
import type {
  WorkspaceDatasetFile,
  WorkspaceDatasetDescriptiveUpdate,
  WorkspaceDeletionRequest,
  WorkspaceFileDownload,
  WorkspacePerson,
  WorkspaceRelationshipMutationResult,
  WorkspaceRelationshipOperation,
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

type WorkspaceRelationshipResourceDetail = Extract<
  WorkspaceResourceDetail,
  { kind: "sample" | "dataset" }
>

const apiFileDownloadSchema = z
  .object({
    expires_in: z.number().nullable(),
    url: z.string().nullable(),
  })
  .strict()

const workspaceDeletionRequestSchema = z
  .object({
    id: z.number(),
    project_id: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
    request_time: z.string().nullable().optional(),
    requester_id: z.string(),
    resource_id: z.string(),
    resource_name: z.string().nullable().optional(),
    resource_type: z.string().nullable().optional(),
    review_time: z.string().nullable().optional(),
    reviewer_id: z.string().nullable().optional(),
    reviewer_notes: z.string().nullable().optional(),
    status: z.string(),
  })
  .passthrough()

function workspaceDeletionRequest(
  value: unknown
): WorkspaceDeletionRequest | null {
  const result = workspaceDeletionRequestSchema.safeParse(value)
  if (!result.success) return null
  return {
    id: result.data.id,
    project_id: result.data.project_id ?? null,
    reason: result.data.reason ?? null,
    request_time: result.data.request_time ?? null,
    requester_id: result.data.requester_id,
    resource_id: result.data.resource_id,
    resource_name: result.data.resource_name ?? null,
    resource_type: result.data.resource_type ?? null,
    review_time: result.data.review_time ?? null,
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

function safeOwner(value: unknown): WorkspacePerson | null {
  if (typeof value !== "object" || value === null) return null
  const owner = value as Record<string, unknown>
  if (
    typeof owner.unique_id !== "string" ||
    typeof owner.first_name !== "string" ||
    typeof owner.last_name !== "string" ||
    (typeof owner.username !== "string" && owner.username != null)
  ) {
    return null
  }
  return {
    unique_id: owner.unique_id,
    first_name: owner.first_name,
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
    creation_time: resource.creation_time ?? null,
    modification_time: resource.modification_time ?? null,
    scientific_metadata: normalizeScientificMetadata(
      resource.scientific_metadata
    ),
  }
}

function toWorkspaceResource(resource: ApiResource): WorkspaceResourceDetail {
  if (isDataset(resource)) {
    return {
      ...commonResource(
        resource,
        "dataset",
        resource.dataset_name ?? "Untitled dataset",
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
      links: resource.links ?? null,
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
      links: resource.links ?? null,
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
      resource.lead
    ),
    kind: "project",
    project_id: resource.project_id,
    organization: resource.organization,
    status: resource.status ?? null,
  }
}

function fixtureWorkspace(scenario?: FixtureScenario) {
  const source = readWorkspaceFixture(scenario)
  if (source.status === "unavailable") throw new Error(source.reason)
  return source.workspace
}

export async function readWorkspaceResource(
  resourceMfid: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
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
      return toWorkspaceResource({ ...template, ...dataset })
    }
    const sample = workspace.samples.find(
      (candidate) => candidate.unique_id === resourceMfid
    )
    if (sample) {
      const template =
        demoWorkspace.samples.find(
          (candidate) => candidate.unique_id === resourceMfid
        ) ?? demoWorkspace.samples[0]
      return toWorkspaceResource({ ...template, ...sample })
    }
    const instrument = workspace.instruments.find(
      (candidate) => candidate.unique_id === resourceMfid
    )
    if (instrument) {
      const template =
        demoWorkspace.instruments.find(
          (candidate) => candidate.unique_id === resourceMfid
        ) ?? demoWorkspace.instruments[0]
      return toWorkspaceResource({ ...template, ...instrument })
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
    return toWorkspaceResource({
      ...template,
      ...projectFields,
      members:
        members === undefined ? undefined : members ? [...members] : null,
    })
  }

  const client = createCrucibleClient(configuration)
  const result = await client.GET("/resources/{resource_id}", {
    params: {
      path: { resource_id: resourceMfid },
      query: {
        include_datasets: false,
        include_links: true,
        include_metadata: true,
        include_owner: true,
      },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (result.response.status === 404) return null
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
  }
  return toWorkspaceResource(result.data)
}

export async function readWorkspaceDatasetFiles(
  datasetMfid: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<readonly WorkspaceDatasetFile[]> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    return fixtureWorkspace(scenario).files.filter(
      (file) => file.dataset_mfid === datasetMfid
    )
  }

  const client = createCrucibleClient(configuration)
  const result = await client.GET("/datasets/{dsid}/files", {
    params: { path: { dsid: datasetMfid } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
  }
  return result.data
}

function workspaceFileDownload(value: unknown): WorkspaceFileDownload {
  const result = apiFileDownloadSchema.safeParse(value)
  if (!result.success) throw new Error("The file download response is invalid.")
  const { expires_in: expiresInSeconds, url } = result.data
  if (url === null && expiresInSeconds === null) {
    return { status: "unavailable" }
  }
  if (
    url === null ||
    expiresInSeconds === null ||
    !Number.isInteger(expiresInSeconds) ||
    expiresInSeconds <= 0
  ) {
    throw new Error("The file download response is inconsistent.")
  }
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error("The file download URL is invalid.")
  }
  if (
    url !== url.trim() ||
    parsedUrl.protocol !== "https:" ||
    !parsedUrl.hostname ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error("The file download URL is invalid.")
  }
  return { status: "ready", url, expiresInSeconds }
}

export async function createWorkspaceFileDownload(
  fileMfid: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceFileDownload> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const file = fixtureWorkspace(scenario).files.find(
      (candidate) => candidate.mfid === fileMfid
    )
    if (!file) throw new CrucibleResponseError(404)
    return file.storage_backend === "gcs"
      ? {
          status: "ready",
          url: `https://downloads.crucible.invalid/files/${file.mfid}`,
          expiresInSeconds: 3600,
        }
      : { status: "unavailable" }
  }

  const client = createCrucibleClient(configuration)
  const result = await client.GET("/files/{file_id}/download_link", {
    params: { path: { file_id: fileMfid } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.response.ok) {
    throw new CrucibleResponseError(result.response.status)
  }
  return workspaceFileDownload(result.data)
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
  const result = await client.PATCH("/samples/{sample_id}", {
    body: changes,
    params: { path: { sample_id: resourceMfid } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
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
      dataset_name: dataset.dataset_name ?? "Untitled dataset",
      measurement: dataset.measurement ?? null,
      modification_time: dataset.modification_time ?? null,
      session_name: template.session_name,
      timestamp: template.timestamp,
      unique_id: dataset.unique_id,
      ...changes,
    })
  }

  const client = createCrucibleClient(configuration)
  const result = await client.PATCH("/datasets/{dsid}", {
    body: changes,
    params: { path: { dsid: resourceMfid } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
  }
  return workspaceDatasetDescriptiveUpdate({
    data_format: result.data.data_format ?? null,
    data_type: result.data.data_type ?? null,
    dataset_name: result.data.dataset_name ?? "Untitled dataset",
    measurement: result.data.measurement ?? null,
    modification_time: result.data.modification_time ?? null,
    session_name: result.data.session_name ?? null,
    timestamp: result.data.timestamp ?? null,
    unique_id: result.data.unique_id,
  })
}

export async function requestWorkspaceResourceDeletion(
  resourceMfid: string,
  reason?: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceDeletionRequest> {
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
      (resource.kind !== "sample" && resource.kind !== "dataset")
    ) {
      throw new CrucibleResponseError(404)
    }
    return {
      id: 1,
      project_id: "project_id" in resource ? resource.project_id : null,
      reason: reason ?? null,
      request_time: "2026-09-06T00:00:00Z",
      requester_id: "0000-0000-0000-000X",
      resource_id: resource.unique_id,
      resource_name: resource.name,
      resource_type: resource.kind,
      review_time: null,
      reviewer_id: null,
      reviewer_notes: null,
      status: "pending",
    }
  }

  const client = createCrucibleClient(configuration)
  const result = await client.POST("/resources/{resource_id}/delete", {
    params: {
      path: { resource_id: resourceMfid },
      ...(reason === undefined ? {} : { query: { reason } }),
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
  }
  if (result.data.resource_id !== resourceMfid) {
    throw new Error(
      "The deletion request response identifies another resource."
    )
  }
  const deletionRequest = workspaceDeletionRequest(result.data)
  if (!deletionRequest) {
    throw new Error("The deletion request response is invalid.")
  }
  return deletionRequest
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
  resourceKind: "sample" | "dataset",
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
      ? await client.PATCH("/resources/{unique_id}/metadata", {
          body: update.metadata,
          params: { path: { unique_id: resourceMfid } },
          signal: crucibleRequestSignal(requestSignal),
        })
      : await client.POST("/resources/{unique_id}/metadata", {
          body: update.metadata,
          params: {
            path: { unique_id: resourceMfid },
            query: { overwrite: true },
          },
          signal: crucibleRequestSignal(requestSignal),
        })
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
  }
  const normalized = workspaceScientificMetadataUpdate(result.data)
  if (normalized.unique_id !== resourceMfid) {
    throw new Error("The scientific metadata response is invalid.")
  }
  return normalized
}

function relationshipDetail(
  detail: WorkspaceResourceDetail | null,
  kind: WorkspaceRelationshipOperation["sourceKind"],
  role: "source" | "target"
): WorkspaceRelationshipResourceDetail {
  if (!detail) throw new CrucibleResponseError(404)
  if (detail.kind !== kind) {
    throw new Error(`The relationship ${role} does not have the expected kind.`)
  }
  return detail
}

function relationshipLink(
  target: WorkspaceRelationshipResourceDetail,
  relationship: WorkspaceRelationshipOperation["relationship"]
) {
  return {
    name: target.name,
    relationship,
    resource_type: target.kind,
    unique_id: target.unique_id,
  } satisfies Schema<"LinkedResource">
}

function hasRelationshipLink(
  resource: WorkspaceRelationshipResourceDetail,
  targetMfid: string,
  relationship: WorkspaceRelationshipOperation["relationship"]
) {
  return (
    resource.links?.some(
      (link) =>
        link.unique_id === targetMfid && link.relationship === relationship
    ) ?? false
  )
}

function applyRelationshipLink(
  resource: WorkspaceRelationshipResourceDetail,
  target: WorkspaceRelationshipResourceDetail,
  relationship: WorkspaceRelationshipOperation["relationship"],
  action: WorkspaceRelationshipOperation["action"]
) {
  const links = resource.links ?? []
  const exists = hasRelationshipLink(resource, target.unique_id, relationship)
  if (action === "unlink" && !exists) return null
  return {
    ...resource,
    links:
      action === "link"
        ? exists
          ? [...links]
          : [...links, relationshipLink(target, relationship)]
        : links.filter(
            (link) =>
              link.unique_id !== target.unique_id ||
              link.relationship !== relationship
          ),
  }
}

async function fixtureWorkspaceRelationshipMutation(
  operation: WorkspaceRelationshipOperation,
  requestSignal?: AbortSignal
): Promise<WorkspaceRelationshipMutationResult> {
  const source = relationshipDetail(
    await readWorkspaceResource(
      operation.sourceMfid,
      operation.scenario,
      requestSignal
    ),
    operation.sourceKind,
    "source"
  )
  const target = relationshipDetail(
    await readWorkspaceResource(
      operation.targetMfid,
      operation.scenario,
      requestSignal
    ),
    operation.targetKind,
    "target"
  )
  const updatedSource = applyRelationshipLink(
    source,
    target,
    operation.relationship,
    operation.action
  )
  if (!updatedSource) throw new CrucibleResponseError(404)
  const updatedTarget = applyRelationshipLink(
    target,
    source,
    inverseWorkspaceRelationship(operation.relationship),
    operation.action
  )
  if (!updatedTarget) throw new CrucibleResponseError(404)
  return { source: updatedSource, target: updatedTarget }
}

export async function mutateWorkspaceRelationship(
  operation: WorkspaceRelationshipOperation,
  requestSignal?: AbortSignal
): Promise<WorkspaceRelationshipMutationResult> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    return fixtureWorkspaceRelationshipMutation(operation, requestSignal)
  }

  const client = createCrucibleClient(configuration)
  const normalized = workspaceApiRelationshipOperation(operation)
  const result =
    normalized.kind === "sample-lineage"
      ? operation.action === "link"
        ? await client.POST(
            "/samples/{parent_sample_id}/children/{child_sample_id}",
            {
              params: {
                path: {
                  parent_sample_id: normalized.parentMfid,
                  child_sample_id: normalized.childMfid,
                },
              },
              signal: crucibleRequestSignal(requestSignal),
            }
          )
        : await client.DELETE(
            "/samples/{parent_sample_id}/children/{child_sample_id}",
            {
              params: {
                path: {
                  parent_sample_id: normalized.parentMfid,
                  child_sample_id: normalized.childMfid,
                },
              },
              signal: crucibleRequestSignal(requestSignal),
            }
          )
      : normalized.kind === "dataset-lineage"
        ? operation.action === "link"
          ? await client.POST(
              "/datasets/{parent_dataset_id}/children/{child_dataset_id}",
              {
                params: {
                  path: {
                    parent_dataset_id: normalized.parentMfid,
                    child_dataset_id: normalized.childMfid,
                  },
                },
                signal: crucibleRequestSignal(requestSignal),
              }
            )
          : await client.DELETE(
              "/datasets/{parent_dataset_id}/children/{child_dataset_id}",
              {
                params: {
                  path: {
                    parent_dataset_id: normalized.parentMfid,
                    child_dataset_id: normalized.childMfid,
                  },
                },
                signal: crucibleRequestSignal(requestSignal),
              }
            )
        : operation.action === "link"
          ? await client.POST("/datasets/{dsid}/samples/{sample_id}", {
              params: {
                path: {
                  dsid: normalized.datasetMfid,
                  sample_id: normalized.sampleMfid,
                },
              },
              signal: crucibleRequestSignal(requestSignal),
            })
          : await client.DELETE("/datasets/{dsid}/samples/{sample_id}", {
              params: {
                path: {
                  dsid: normalized.datasetMfid,
                  sample_id: normalized.sampleMfid,
                },
              },
              signal: crucibleRequestSignal(requestSignal),
            })
  if (!result.response.ok) {
    throw new CrucibleResponseError(result.response.status)
  }

  const [source, target] = await Promise.all([
    readWorkspaceResource(
      operation.sourceMfid,
      operation.scenario,
      requestSignal
    ),
    readWorkspaceResource(
      operation.targetMfid,
      operation.scenario,
      requestSignal
    ),
  ])
  return {
    source: relationshipDetail(source, operation.sourceKind, "source"),
    target: relationshipDetail(target, operation.targetKind, "target"),
  }
}
