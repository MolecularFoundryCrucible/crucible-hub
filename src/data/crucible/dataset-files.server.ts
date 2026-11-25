import "@tanstack/react-start/server-only"

import { z } from "zod"
import { demoWorkspace } from "@/data/crucible/fixtures/demo-workspace"
import {
  CrucibleContractError,
  CrucibleResponseError,
} from "@/server/crucible/request-error.server"
import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import { apiDatasetFileSchema } from "./dataset-files.schema"
import {
  findFixtureUploadedFile,
  fixtureCurrentFile,
  fixtureUploadedFilesFor,
} from "./uploads.server"
import type { FixtureScenario } from "./fixture-scenarios"
import type { WorkspacePrivilegeMode } from "./privilege-mode"
import type {
  WorkspaceDatasetFile,
  WorkspaceIngestionRequest,
  WorkspaceIngestionRequestPage,
  WorkspaceFileDisposition,
  WorkspaceFileDownload,
  WorkspaceIngestor,
  WorkspaceStore,
} from "./workspace-source"

import { fixtureWorkspace, readWorkspaceResource } from "./resources.server"

const apiFileDownloadSchema = z
  .object({
    expires_in: z.number().nullable(),
    url: z.string().nullable(),
  })
  .strict()

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

const fixtureIngestionState = new Map<string, WorkspaceIngestionRequest[]>()

export async function readWorkspaceDatasetFiles(
  datasetMfid: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal,
  privilegeMode?: WorkspacePrivilegeMode
): Promise<readonly WorkspaceDatasetFile[]> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    return [
      ...fixtureWorkspace(scenario)
        .files.filter((file) => file.dataset_mfid === datasetMfid)
        .map(fixtureCurrentFile),
      ...fixtureUploadedFilesFor(datasetMfid),
    ]
  }

  const client = createCrucibleClient(configuration, { privilegeMode })
  const result = await client.GET("/datasets/{dataset_mfid}/files", {
    params: { path: { dataset_mfid: datasetMfid } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  const files = apiDatasetFilesSchema.safeParse(result.data)
  if (!files.success) {
    throw new CrucibleContractError("dataset-files", files.error.issues)
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
    if (!dataset && !datasetMfid.startsWith("fixture-dataset-")) {
      throw new CrucibleResponseError(404)
    }
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
      query: { dataset_mfid: datasetMfid, limit: 100, offset: 0 },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  const page = apiIngestionRequestPageSchema.safeParse(result.data)
  if (!page.success) {
    throw new CrucibleContractError(
      "dataset-ingestion-requests",
      page.error.issues
    )
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

const apiIngestorsSchema = z
  .array(
    z
      .object({
        description: z.string().nullable().optional(),
        file_extensions: z.array(z.string()).optional(),
        name: z.string(),
      })
      .passthrough()
  )
  .max(1_000)

const fixtureIngestors: readonly WorkspaceIngestor[] = [
  {
    description: "HDF5 files of any layout, as plain arrays and attributes.",
    fileExtensions: [".h5", ".hdf5"],
    name: "H5Ingestor",
  },
  {
    description: "Images in common formats.",
    fileExtensions: [".png", ".jpg", ".jpeg", ".tif", ".tiff"],
    name: "ImageIngestor",
  },
  {
    description: "HDF5 files written by ScopeFoundry.",
    fileExtensions: [".h5"],
    name: "ScopeFoundryH5Ingestor",
  },
]

export async function readWorkspaceIngestors(
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<readonly WorkspaceIngestor[]> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    fixtureWorkspace(scenario)
    return fixtureIngestors
  }

  const client = createCrucibleClient(configuration, { privilegeMode: null })
  const result = await client.GET("/ingestors/details", {
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  const ingestors = apiIngestorsSchema.safeParse(result.data)
  if (!ingestors.success) {
    throw new CrucibleContractError("ingestors", ingestors.error.issues)
  }
  return ingestors.data.map((ingestor) => ({
    description: ingestor.description?.trim() || null,
    fileExtensions: (ingestor.file_extensions ?? []).map((extension) =>
      extension.toLowerCase()
    ),
    name: ingestor.name,
  }))
}

const apiStoresSchema = z
  .array(
    z
      .object({
        default: z.boolean(),
        description: z.string().nullable().optional(),
        display_name: z.string().min(1).max(255),
        id: z.string().min(1).max(63),
      })
      .passthrough()
  )
  .max(100)

const fixtureStores: readonly WorkspaceStore[] = [
  {
    default: true,
    description: null,
    display_name: "Foundry storage",
    id: "foundry",
  },
  {
    default: false,
    description: "Long-term storage for large imaging data.",
    display_name: "Imaging archive",
    id: "imaging-archive",
  },
]

export async function readWorkspaceStores(
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<readonly WorkspaceStore[]> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    fixtureWorkspace(scenario)
    return fixtureStores
  }

  const client = createCrucibleClient(configuration, { privilegeMode: null })
  const result = await client.GET("/storage/stores", {
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  const stores = apiStoresSchema.safeParse(result.data)
  if (!stores.success) {
    throw new CrucibleContractError("storage-stores", stores.error.issues)
  }
  return stores.data.map((store) => ({
    default: store.default,
    description: store.description ?? null,
    display_name: store.display_name,
    id: store.id,
  }))
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
    const file =
      workspace.files.find((candidate) => candidate.mfid === fileMfid) ??
      findFixtureUploadedFile(fileMfid)
    if (!file) throw new CrucibleResponseError(404)
    if (file.storage_backend !== "gcs") throw new CrucibleResponseError(400)
    const createdHere = file.dataset_mfid.startsWith("fixture-dataset-")
    const dataset = createdHere
      ? undefined
      : await readWorkspaceResource(file.dataset_mfid, scenario, requestSignal)
    if (
      !createdHere &&
      (dataset?.kind !== "dataset" || !dataset.capabilities?.can_edit)
    ) {
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
    throw new CrucibleResponseError(result.response, result.error)
  }
  return workspaceIngestionRequest(result.data)
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
  requestSignal?: AbortSignal,
  disposition: WorkspaceFileDisposition = "attachment"
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
          url: `https://downloads.crucible.invalid/files/${file.mfid}${disposition === "inline" ? "?disposition=inline" : ""}`,
          expiresInSeconds: 3600,
        }
      : { status: "unavailable" }
  }

  const client = createCrucibleClient(configuration)
  const result = await client.GET("/files/{file_id}/download_link", {
    params: {
      path: { file_id: fileMfid },
      ...(disposition === "inline" ? { query: { disposition } } : {}),
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (result.response.status === 409 || result.response.status === 503) {
    const conflict = new CrucibleResponseError(result.response, result.error)
    if (
      (result.response.status === 409 && conflict.conflictCode === undefined) ||
      conflict.conflictCode === "storage_location_invalid" ||
      conflict.conflictCode === "store_unavailable"
    )
      return { status: "unavailable" }
    throw conflict
  }
  if (!result.response.ok) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  return workspaceFileDownload(result.data)
}
