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
  WorkspaceDatasetInstrumentAssignment,
  WorkspaceIngestionRequest,
  WorkspaceIngestionRequestPage,
  WorkspaceDatasetThumbnail,
  WorkspaceDatasetThumbnailOperation,
  WorkspaceDatasetDescriptiveUpdate,
  WorkspaceDeletionRequest,
  WorkspaceFileDownload,
  WorkspaceLinkedResource,
  WorkspacePerson,
  WorkspaceOwnershipTransfer,
  WorkspaceProjectReassignment,
  WorkspaceRelationshipMutationResult,
  WorkspaceRelationshipOperation,
  WorkspaceResourceDetail,
  WorkspaceResourceGraph,
  WorkspaceResourceGraphEdge,
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

const apiDatasetFileSchema = z
  .object({
    access_note: z.string().nullable().optional(),
    dataset_id: z.number().int(),
    dataset_mfid: z.string().min(1).max(255),
    filename: z.string().min(1).max(10_000),
    mfid: z.string().min(1).max(255),
    sha256_hash: z.string(),
    size: z.number().int().nonnegative(),
    storage_backend: z.string().min(1).max(255),
    storage_path: z.string().nullable().optional(),
  })
  .passthrough()

const apiDatasetFilesSchema = z.array(apiDatasetFileSchema).max(10_000)

const apiIngestionRequestSchema = z
  .object({
    dataset_mfid: z.string().nullable().optional(),
    file_mfid: z.string().nullable().optional(),
    file_to_upload: z.string().nullable().optional(),
    id: z.number().int().nullable().optional(),
    ingestion_class: z.string().nullable().optional(),
    ingestion_githash: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    time_completed: z.string().nullable().optional(),
    time_created: z.string().nullable().optional(),
  })
  .passthrough()

const apiIngestionRequestPageSchema = z
  .object({
    items: z.array(apiIngestionRequestSchema).max(1_000),
    total: z.number().int().nonnegative().nullable().optional(),
  })
  .passthrough()

const apiResourceGraphSchema = z
  .object({
    directed: z.literal(true),
    edges: z
      .array(
        z
          .object({
            source: z.string().min(1).max(255),
            target: z.string().min(1).max(255),
          })
          .passthrough()
      )
      .max(5_000),
    nodes: z
      .array(
        z
          .object({
            entity_type: z.enum(["dataset", "sample"]),
            id: z.string().min(1).max(255),
            name: z.string().nullable().optional(),
          })
          .passthrough()
      )
      .max(1_000),
  })
  .passthrough()

const apiDatasetThumbnailSchema = z
  .object({
    id: z.number().int().positive(),
    mime_type: z.literal("image/jpeg"),
    thumbnail_b64str: z
      .string()
      .min(1)
      .max(2_000_000)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
    thumbnail_name: z.string().min(1).max(10_000),
  })
  .passthrough()

const demoThumbnailBase64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAQABADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABv/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKQBokf/2Q=="

const fixtureThumbnailState = new Map<string, WorkspaceDatasetThumbnail[]>()
const fixtureIngestionState = new Map<string, WorkspaceIngestionRequest[]>()

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
  requestSignal?: AbortSignal,
  projection: "overview" | "summary" = "overview"
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

  const client = createCrucibleClient(configuration)
  const result = await client.GET("/resources/{resource_id}", {
    params: {
      path: { resource_id: resourceMfid },
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
    throw new CrucibleResponseError(result.response.status)
  }
  return toWorkspaceResourceDetail(result.data)
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
  const files = apiDatasetFilesSchema.safeParse(result.data)
  if (!files.success) {
    throw new Error("The dataset files response is invalid.")
  }
  return files.data
}

export async function readWorkspaceDatasetIngestionRequests(
  datasetMfid: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceIngestionRequestPage> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const dataset = fixtureWorkspace(scenario).datasets.find(
      (candidate) => candidate.unique_id === datasetMfid
    )
    if (!dataset) throw new CrucibleResponseError(404)
    const key = fixtureIngestionKey(datasetMfid, scenario)
    const stored = fixtureIngestionState.get(key)
    if (stored) return { items: stored, total: stored.length }
    const fileMfid = fixtureWorkspace(scenario).files.find(
      (file) => file.dataset_mfid === datasetMfid
    )?.mfid
    const requests =
      datasetMfid === demoWorkspace.datasets[0].unique_id && fileMfid
        ? [
            {
              datasetMfid,
              fileMfid,
              fileToUpload: null,
              id: 101,
              ingestionClass: "H5Ingestor",
              ingestionGitHash: "a1b2c3d",
              status: "complete",
              timeCompleted: "2026-08-28T18:06:00Z",
              timeCreated: "2026-08-28T17:58:00Z",
            },
          ]
        : []
    fixtureIngestionState.set(key, requests)
    return { items: requests, total: requests.length }
  }

  const client = createCrucibleClient(configuration)
  const result = await client.GET("/ingestion_requests", {
    params: {
      query: { dataset_id: datasetMfid, limit: 100, offset: 0 },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
  }
  const page = apiIngestionRequestPageSchema.safeParse(result.data)
  if (!page.success) {
    throw new Error("The ingestion requests response is invalid.")
  }
  return {
    items: page.data.items.map(workspaceIngestionRequest),
    total: page.data.total ?? page.data.items.length,
  }
}

function fixtureIngestionKey(datasetMfid: string, scenario?: FixtureScenario) {
  return `${scenario ?? "populated"}\0${datasetMfid}`
}

function workspaceIngestionRequest(
  request: z.infer<typeof apiIngestionRequestSchema>
): WorkspaceIngestionRequest {
  return {
    datasetMfid: request.dataset_mfid ?? null,
    fileMfid: request.file_mfid ?? null,
    fileToUpload: request.file_to_upload ?? null,
    id: request.id ?? null,
    ingestionClass: request.ingestion_class ?? null,
    ingestionGitHash: request.ingestion_githash ?? null,
    status: request.status ?? null,
    timeCompleted: request.time_completed ?? null,
    timeCreated: request.time_created ?? null,
  }
}

export async function readWorkspaceIngestionClasses(
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<readonly string[]> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    fixtureWorkspace(scenario)
    return ["H5Ingestor", "ImageIngestor"]
  }

  const client = createCrucibleClient(configuration)
  const result = await client.GET("/ingestors", {
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
  }
  return [...new Set(result.data.map((value) => value.trim()).filter(Boolean))]
}

export async function requestWorkspaceFileIngestion(
  fileMfid: string,
  ingestionClass?: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceIngestionRequest> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const workspace = fixtureWorkspace(scenario)
    const file = workspace.files.find(
      (candidate) => candidate.mfid === fileMfid
    )
    if (!file) throw new CrucibleResponseError(404)
    if (file.storage_backend !== "gcs") throw new CrucibleResponseError(400)
    const dataset = await readWorkspaceResource(
      file.dataset_mfid,
      scenario,
      requestSignal
    )
    if (dataset?.kind !== "dataset" || !dataset.capabilities?.can_edit) {
      throw new CrucibleResponseError(403)
    }
    const key = fixtureIngestionKey(file.dataset_mfid, scenario)
    const current = [
      ...(
        await readWorkspaceDatasetIngestionRequests(
          file.dataset_mfid,
          scenario,
          requestSignal
        )
      ).items,
    ]
    const request = {
      datasetMfid: file.dataset_mfid,
      fileMfid,
      fileToUpload: file.storage_path ?? null,
      id: Math.max(0, ...current.map((candidate) => candidate.id ?? 0)) + 1,
      ingestionClass: ingestionClass ?? null,
      ingestionGitHash: null,
      status: "requested",
      timeCompleted: null,
      timeCreated: new Date().toISOString(),
    }
    fixtureIngestionState.set(key, [request, ...current])
    return request
  }

  const client = createCrucibleClient(configuration)
  const result = await client.POST("/files/{file_id}/ingest", {
    params: {
      path: { file_id: fileMfid },
      query: {
        ...(ingestionClass ? { ingestion_class: ingestionClass } : {}),
        status: "requested",
      },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
  }
  return workspaceIngestionRequest(result.data)
}

function workspaceDatasetThumbnail(value: unknown): WorkspaceDatasetThumbnail {
  const result = apiDatasetThumbnailSchema.safeParse(value)
  if (!result.success) {
    throw new Error("The dataset thumbnail response is invalid.")
  }
  return {
    id: result.data.id,
    mime_type: result.data.mime_type,
    thumbnail_b64str: result.data.thumbnail_b64str,
    thumbnail_name: result.data.thumbnail_name,
  }
}

function fixtureThumbnailKey(datasetMfid: string, scenario?: FixtureScenario) {
  return `${scenario ?? "populated"}\0${datasetMfid}`
}

function readFixtureDatasetThumbnails(
  datasetMfid: string,
  scenario?: FixtureScenario
) {
  const dataset = fixtureWorkspace(scenario).datasets.find(
    (candidate) => candidate.unique_id === datasetMfid
  )
  if (!dataset) throw new CrucibleResponseError(404)
  const key = fixtureThumbnailKey(datasetMfid, scenario)
  const stored = fixtureThumbnailState.get(key)
  if (stored) return stored
  const thumbnails =
    datasetMfid === demoWorkspace.datasets[0]?.unique_id ||
    datasetMfid === "fixture-dataset-1"
      ? [
          {
            id: 1,
            mime_type: "image/jpeg" as const,
            thumbnail_b64str: demoThumbnailBase64,
            thumbnail_name: "Operando preview",
          },
        ]
      : []
  fixtureThumbnailState.set(key, thumbnails)
  return thumbnails
}

export async function readWorkspaceDatasetThumbnails(
  datasetMfid: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<readonly WorkspaceDatasetThumbnail[]> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    return readFixtureDatasetThumbnails(datasetMfid, scenario)
  }

  const client = createCrucibleClient(configuration)
  const result = await client.GET("/datasets/{dsid}/thumbnails", {
    params: { path: { dsid: datasetMfid } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
  }
  return result.data.map(workspaceDatasetThumbnail)
}

export async function readWorkspaceDatasetThumbnailPreviews(
  datasetMfids: readonly string[],
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<Readonly<Partial<Record<string, WorkspaceDatasetThumbnail>>>> {
  const uniqueDatasetMfids = [...new Set(datasetMfids)]
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    return Object.fromEntries(
      uniqueDatasetMfids.flatMap((datasetMfid) => {
        const thumbnail = readFixtureDatasetThumbnails(
          datasetMfid,
          scenario
        ).at(0)
        return thumbnail ? [[datasetMfid, thumbnail]] : []
      })
    )
  }

  const client = createCrucibleClient(configuration)
  const result = await client.POST("/datasets/first_thumbnails", {
    body: uniqueDatasetMfids,
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
  }
  return Object.fromEntries(
    Object.entries(result.data).map(([datasetMfid, thumbnail]) => [
      datasetMfid,
      workspaceDatasetThumbnail(thumbnail),
    ])
  )
}

export async function mutateWorkspaceDatasetThumbnails(
  operation: WorkspaceDatasetThumbnailOperation,
  requestSignal?: AbortSignal
): Promise<readonly WorkspaceDatasetThumbnail[]> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const dataset = await readWorkspaceResource(
      operation.datasetMfid,
      operation.scenario,
      requestSignal
    )
    if (dataset?.kind !== "dataset" || !dataset.capabilities?.can_edit) {
      throw new CrucibleResponseError(404)
    }
    const current = [
      ...readFixtureDatasetThumbnails(
        operation.datasetMfid,
        operation.scenario
      ),
    ]
    if (operation.action === "add") {
      const duplicate = current.find(
        (thumbnail) => thumbnail.thumbnail_b64str === operation.thumbnail_b64str
      )
      if (duplicate) duplicate.thumbnail_name = operation.thumbnail_name
      else {
        current.push({
          id: Math.max(0, ...current.map((thumbnail) => thumbnail.id)) + 1,
          mime_type: "image/jpeg",
          thumbnail_b64str: operation.thumbnail_b64str,
          thumbnail_name: operation.thumbnail_name,
        })
      }
    } else if (operation.action === "rename") {
      const thumbnail = current.find(
        (candidate) => candidate.id === operation.thumbnailId
      )
      if (!thumbnail) throw new CrucibleResponseError(404)
      thumbnail.thumbnail_name = operation.thumbnail_name
    } else {
      const index = current.findIndex(
        (thumbnail) => thumbnail.id === operation.thumbnailId
      )
      if (index < 0) throw new CrucibleResponseError(404)
      current.splice(index, 1)
    }
    fixtureThumbnailState.set(
      fixtureThumbnailKey(operation.datasetMfid, operation.scenario),
      current
    )
    return current
  }

  const client = createCrucibleClient(configuration)
  if (operation.action === "add") {
    const result = await client.POST("/datasets/{dsid}/thumbnails", {
      body: {
        thumbnail_b64str: operation.thumbnail_b64str,
        thumbnail_name: operation.thumbnail_name,
      },
      params: { path: { dsid: operation.datasetMfid } },
      signal: crucibleRequestSignal(requestSignal),
    })
    if (!result.data) throw new CrucibleResponseError(result.response.status)
  } else if (operation.action === "rename") {
    const result = await client.PATCH(
      "/datasets/{dsid}/thumbnails/{thumbnail_id}",
      {
        body: { thumbnail_name: operation.thumbnail_name },
        params: {
          path: {
            dsid: operation.datasetMfid,
            thumbnail_id: operation.thumbnailId,
          },
        },
        signal: crucibleRequestSignal(requestSignal),
      }
    )
    if (!result.data) throw new CrucibleResponseError(result.response.status)
  } else {
    const result = await client.DELETE(
      "/datasets/{dsid}/thumbnails/{thumbnail_id}",
      {
        params: {
          path: {
            dsid: operation.datasetMfid,
            thumbnail_id: operation.thumbnailId,
          },
        },
        signal: crucibleRequestSignal(requestSignal),
      }
    )
    if (!result.data) throw new CrucibleResponseError(result.response.status)
  }
  return readWorkspaceDatasetThumbnails(
    operation.datasetMfid,
    operation.scenario,
    requestSignal
  )
}

function fixtureResourceGraph(
  resource: Extract<WorkspaceResourceDetail, { kind: "dataset" | "sample" }>
): WorkspaceResourceGraph {
  const nodes = new Map([
    [
      resource.unique_id,
      {
        kind: resource.kind,
        name: resource.name,
        unique_id: resource.unique_id,
      },
    ],
  ])
  const edges = (resource.links ?? []).flatMap(
    (link): WorkspaceResourceGraphEdge[] => {
      if (link.resource_type !== "dataset" && link.resource_type !== "sample") {
        return []
      }
      nodes.set(link.unique_id, {
        kind: link.resource_type,
        name: link.name || link.unique_id,
        unique_id: link.unique_id,
      })
      if (link.relationship === "parent") {
        return [
          {
            relationship: "parent" as const,
            source: link.unique_id,
            target: resource.unique_id,
          },
        ]
      }
      if (link.relationship === "child") {
        return [
          {
            relationship: "parent" as const,
            source: resource.unique_id,
            target: link.unique_id,
          },
        ]
      }
      return [
        {
          relationship: "associated" as const,
          source:
            resource.kind === "sample" ? resource.unique_id : link.unique_id,
          target:
            resource.kind === "sample" ? link.unique_id : resource.unique_id,
        },
      ]
    }
  )
  return { edges, nodes: [...nodes.values()], rootMfid: resource.unique_id }
}

function normalizeApiResourceGraph(
  value: unknown,
  rootMfid: string
): WorkspaceResourceGraph {
  const result = apiResourceGraphSchema.safeParse(value)
  if (!result.success) {
    throw new Error("The resource graph response is invalid.")
  }
  const nodes = new Map(
    result.data.nodes.map((node) => [
      node.id,
      {
        kind: node.entity_type,
        name: node.name || node.id,
        unique_id: node.id,
      },
    ])
  )
  if (nodes.size !== result.data.nodes.length || !nodes.has(rootMfid)) {
    throw new Error("The resource graph response has invalid nodes.")
  }
  const edgeKeys = new Set<string>()
  const edges = result.data.edges.map((edge) => {
    const source = nodes.get(edge.source)
    const target = nodes.get(edge.target)
    if (!source || !target) {
      throw new Error("The resource graph response has an invalid edge.")
    }
    const edgeKey = `${edge.source}\u0000${edge.target}`
    if (edgeKeys.has(edgeKey)) {
      throw new Error("The resource graph response has duplicate edges.")
    }
    edgeKeys.add(edgeKey)
    return {
      relationship:
        source.kind === target.kind
          ? ("parent" as const)
          : ("associated" as const),
      source: edge.source,
      target: edge.target,
    }
  })
  const orderedNodes = [...nodes.values()].sort((left, right) => {
    if (left.unique_id === rootMfid) return -1
    if (right.unique_id === rootMfid) return 1
    return left.name.localeCompare(right.name)
  })
  edges.sort(
    (left, right) =>
      left.source.localeCompare(right.source) ||
      left.target.localeCompare(right.target)
  )
  return { edges, nodes: orderedNodes, rootMfid }
}

export async function readWorkspaceResourceGraph(
  resourceMfid: string,
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
    return fixtureResourceGraph(resource)
  }

  const client = createCrucibleClient(configuration)
  const result = await client.GET("/entity_graph_cte/{entity_id}", {
    params: {
      path: { entity_id: resourceMfid },
      query: { recursive: false },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return normalizeApiResourceGraph(result.data, resourceMfid)
}

function fixtureOwner(
  ownerReference: string,
  scenario?: FixtureScenario
): WorkspacePerson {
  const workspace = fixtureWorkspace(scenario)
  const person = workspace.people.find(
    (candidate) =>
      candidate.unique_id === ownerReference ||
      candidate.username === ownerReference
  )
  if (person) return person
  const serviceAccount = workspace.projects
    .flatMap((project) =>
      "members" in project && project.members ? project.members : []
    )
    .find(
      (candidate) =>
        candidate.is_service_account === true &&
        (candidate.unique_id === ownerReference ||
          candidate.username === ownerReference)
    )
  if (!serviceAccount) throw new CrucibleResponseError(404)
  const owner = safeOwner(serviceAccount)
  if (!owner) throw new CrucibleResponseError(404)
  return owner
}

export async function transferWorkspaceResourceOwnership(
  resourceMfid: string,
  newOwner: string,
  confirm: boolean,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceOwnershipTransfer> {
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
    if (!resource) throw new CrucibleResponseError(404)
    return {
      resource_id: resourceMfid,
      previous_owner: resource.owner,
      new_owner: fixtureOwner(newOwner, scenario),
    }
  }

  const client = createCrucibleClient(configuration)
  const result = await client.POST("/resources/{mfid}/transfer_ownership", {
    body: { new_owner: newOwner },
    params: { path: { mfid: resourceMfid }, query: { confirm } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  if (result.data.resource_id !== resourceMfid) {
    throw new Error("The ownership response identifies another resource.")
  }
  return result.data
}

export async function reassignWorkspaceResourceProject(
  resourceMfid: string,
  projectMfid: string,
  confirm: boolean,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceProjectReassignment> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  let projectId: string
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
    const project = fixtureWorkspace(scenario).projects.find(
      (candidate) => candidate.unique_id === projectMfid
    )
    if (!project) throw new CrucibleResponseError(404)
    projectId = project.project_id
    return {
      resource_id: resourceMfid,
      previous_project_id: resource.project_id,
      new_project_id: projectId,
    }
  }

  const client = createCrucibleClient(configuration)
  const projectResult = await client.GET("/projects/{project_ref}", {
    params: {
      path: { project_ref: projectMfid },
      query: {
        include_members: false,
        include_metadata: false,
      },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!projectResult.data) {
    throw new CrucibleResponseError(projectResult.response.status)
  }
  projectId = projectResult.data.project_id
  const result = await client.POST("/resources/{mfid}/project", {
    body: { project_id: projectId },
    params: { path: { mfid: resourceMfid }, query: { confirm } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  if (result.data.resource_id !== resourceMfid) {
    throw new Error(
      "The project assignment response identifies another resource."
    )
  }
  return result.data
}

export async function setWorkspaceDatasetInstrument(
  datasetMfid: string,
  instrumentMfid: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceDatasetInstrumentAssignment> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const dataset = await readWorkspaceResource(
      datasetMfid,
      scenario,
      requestSignal
    )
    if (!dataset || dataset.kind !== "dataset") {
      throw new CrucibleResponseError(404)
    }
    const instrument = fixtureWorkspace(scenario).instruments.find(
      (candidate) => candidate.unique_id === instrumentMfid
    )
    if (!instrument) throw new CrucibleResponseError(404)
    return {
      dataset_mfid: datasetMfid,
      instrument: {
        instrument_id: instrument.instrument_id,
        instrument_name: instrument.instrument_name,
        unique_id: instrument.unique_id,
      },
      previous_instrument: dataset.instrument,
      previous_instrument_name: dataset.instrument?.instrument_name ?? null,
    }
  }

  const client = createCrucibleClient(configuration)
  const result = await client.PUT("/datasets/{dsid}/instrument", {
    body: { instrument_mfid: instrumentMfid },
    params: { path: { dsid: datasetMfid } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  if (
    result.data.dataset_mfid !== datasetMfid ||
    result.data.instrument.unique_id !== instrumentMfid
  ) {
    throw new Error("The instrument assignment response is invalid.")
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
  relationship: WorkspaceRelationshipOperation["relationship"],
  relationshipType: WorkspaceLinkedResource["relationship_type"]
) {
  return {
    name: target.name,
    relationship,
    relationship_type: relationshipType ?? null,
    resource_type: target.kind,
    unique_id: target.unique_id,
  } satisfies WorkspaceLinkedResource
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
  relationshipType: WorkspaceLinkedResource["relationship_type"],
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
          : [...links, relationshipLink(target, relationship, relationshipType)]
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
    operation.relationship === "associated" ? null : operation.relationshipType,
    operation.action
  )
  if (!updatedSource) throw new CrucibleResponseError(404)
  const updatedTarget = applyRelationshipLink(
    target,
    source,
    inverseWorkspaceRelationship(operation.relationship),
    operation.relationship === "associated" ? null : operation.relationshipType,
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
                ...(normalized.relationshipType
                  ? {
                      query: {
                        relationship_type: normalized.relationshipType,
                      },
                    }
                  : {}),
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
                  ...(normalized.relationshipType
                    ? {
                        query: {
                          relationship_type: normalized.relationshipType,
                        },
                      }
                    : {}),
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
