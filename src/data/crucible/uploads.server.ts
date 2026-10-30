import "@tanstack/react-start/server-only"

import { z } from "zod"

import { createCrucibleClient } from "@/server/crucible/client.server"
import {
  CrucibleContractError,
  CrucibleResponseError,
} from "@/server/crucible/request-error.server"
import { crucibleRequestSignal } from "@/server/crucible/request-signal.server"

import { apiDatasetFileSchema } from "./dataset-files.schema"

import type { FixtureScenario } from "./fixture-scenarios"
import {
  readUploadsEnabled,
  readWorkspaceConfiguration,
} from "./workspace-config.server"
import type { WorkspaceConfiguration } from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import { MAX_UPLOAD_PART_NUMBER, UPLOAD_PART_SIZE } from "./uploads"
import type {
  WorkspaceDatasetFile,
  WorkspaceUploadInitiation,
  WorkspaceUploadSession,
  WorkspaceUploadSessionState,
  WorkspaceUploadSignedPart,
} from "./workspace-source"

type FixtureUploadSession = {
  acknowledgedPartNumbers: number[]
  datasetMfid: string
  file?: WorkspaceDatasetFile
  filename: string
  partSize: number
  replaceFileMfid?: string
  size: number
  state: WorkspaceUploadSession["state"]
}

const fixtureUploadSessions = new Map<string, FixtureUploadSession>()
const fixtureUploadedFiles = new Map<string, WorkspaceDatasetFile[]>()
const fixtureReplacedFiles = new Map<string, WorkspaceDatasetFile>()

export function fixtureCurrentFile(
  file: WorkspaceDatasetFile
): WorkspaceDatasetFile {
  return fixtureReplacedFiles.get(file.mfid) ?? file
}

function fixtureDatasetFiles(datasetMfid: string, scenario?: FixtureScenario) {
  return [
    ...fixtureWorkspace(scenario)
      .files.filter((file) => file.dataset_mfid === datasetMfid)
      .map(fixtureCurrentFile),
    ...fixtureUploadedFilesFor(datasetMfid),
  ]
}

function fixtureEtag() {
  return `"${crypto.randomUUID().replaceAll("-", "")}"`
}

const filenameExistsSchema = z.object({
  detail: z.object({
    code: z.literal("filename_exists"),
    etag: z.string().min(1).max(255),
    file_mfid: z.string().min(1).max(255),
  }),
})

const etagMismatchSchema = z.object({
  detail: z.object({ code: z.literal("etag_mismatch") }),
})

function fixtureUploadKey(datasetMfid: string, uploadId: string) {
  return `${datasetMfid}\0${uploadId}`
}

export function fixtureUploadedFilesFor(
  datasetMfid: string
): readonly WorkspaceDatasetFile[] {
  return fixtureUploadedFiles.get(datasetMfid) ?? []
}

export function findFixtureUploadedFile(
  fileMfid: string
): WorkspaceDatasetFile | undefined {
  for (const files of fixtureUploadedFiles.values()) {
    const file = files.find((candidate) => candidate.mfid === fileMfid)
    if (file) return file
  }
  return undefined
}

function fixtureWorkspace(scenario?: FixtureScenario) {
  const source = readWorkspaceFixture(scenario)
  if (source.status === "unavailable") throw new Error(source.reason)
  return source.workspace
}

const MIB = 1024 * 1024

function fixturePartSize(size: number) {
  if (size === 0) return 0
  return Math.min(Math.max(Math.ceil(size / 8 / MIB), 8), 64) * MIB
}

const STATUS_PAGE_LIMIT = 1000
const MAX_STATUS_PAGES = Math.ceil(MAX_UPLOAD_PART_NUMBER / STATUS_PAGE_LIMIT)
const COMPLETION_TIMEOUT_MS = 120_000

const apiMultipartStatusSchema = z
  .object({
    existing_file: apiDatasetFileSchema.nullable().optional(),
    failure_code: z.string().nullable().optional(),
    next_part_number_marker: z.number().int().nullable().optional(),
    part_size: z.number().int().nonnegative().nullable().optional(),
    parts: z
      .array(z.object({ part_number: z.number().int().min(1) }).passthrough())
      .max(STATUS_PAGE_LIMIT)
      .optional()
      .default([]),
    state: z.string().min(1),
    upload_id: z.string().min(1).max(255).nullable().optional(),
  })
  .passthrough()

const apiSignedPartsSchema = z
  .object({
    parts: z.array(
      z
        .object({
          headers: z.record(z.string(), z.string()),
          part_number: z.number().int().min(1),
          url: z
            .string()
            .url()
            .refine((url) => new URL(url).protocol === "https:"),
        })
        .passthrough()
    ),
  })
  .passthrough()

function apiUploadState(state: string): WorkspaceUploadSessionState {
  switch (state) {
    case "uploading":
      return "uploading"
    case "completed":
      return "completed"
    case "aborted":
      return "aborted"
    default:
      return "failed"
  }
}

function parseApiStatus(value: unknown) {
  const status = apiMultipartStatusSchema.safeParse(value)
  if (!status.success) {
    throw new CrucibleContractError("multipart-status", status.error.issues)
  }
  return status.data
}

function apiUploadClient(
  configuration: Extract<WorkspaceConfiguration, { mode: "api" }>
) {
  if (!readUploadsEnabled("api")) {
    throw new Error("Dataset uploads are not enabled on this server.")
  }
  return createCrucibleClient(configuration)
}

function readUploadConfiguration() {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  return configuration
}

export async function initializeWorkspaceUploadSession(
  input: {
    datasetMfid: string
    filename: string
    idempotencyKey?: string
    replace?: { etag: string; fileMfid: string }
    size: number
  },
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceUploadInitiation> {
  const configuration = readUploadConfiguration()
  if (configuration.mode === "api") {
    const client = apiUploadClient(configuration)
    const result = input.replace
      ? await client.POST("/files/{file_mfid}/upload/multipart/initiate", {
          body: { size: input.size },
          headers: {
            "If-Match": input.replace.etag,
            ...(input.idempotencyKey
              ? { "Idempotency-Key": input.idempotencyKey }
              : {}),
          },
          params: { path: { file_mfid: input.replace.fileMfid } },
          signal: crucibleRequestSignal(requestSignal),
        })
      : await client.POST(
          "/datasets/{dataset_mfid}/upload/multipart/initiate",
          {
            body: { filename: input.filename, size: input.size },
            params: {
              header: { "idempotency-key": input.idempotencyKey },
              path: { dataset_mfid: input.datasetMfid },
            },
            signal: crucibleRequestSignal(requestSignal),
          }
        )
    if (!result.data) {
      if (result.response.status === 412 && input.replace) {
        if (etagMismatchSchema.safeParse(result.error).success) {
          return { state: "file_changed" }
        }
      }
      if (result.response.status === 409 && !input.replace) {
        const exists = filenameExistsSchema.safeParse(result.error)
        if (exists.success) {
          return {
            etag: exists.data.detail.etag,
            fileMfid: exists.data.detail.file_mfid,
            state: "filename_exists",
          }
        }
      }
      throw new CrucibleResponseError(result.response, result.error)
    }
    const status = parseApiStatus(result.data)
    if (apiUploadState(status.state) === "completed" && status.existing_file) {
      return { file: status.existing_file, state: "completed" }
    }
    if (!status.upload_id) {
      throw new CrucibleContractError("multipart-initiate", [
        { code: "missing_upload_id", path: ["upload_id"] },
      ])
    }
    return {
      partSize: status.part_size ?? UPLOAD_PART_SIZE,
      state: apiUploadState(status.state),
      uploadId: status.upload_id,
    }
  }

  const workspace = fixtureWorkspace(scenario)
  if (
    !input.datasetMfid.startsWith("fixture-dataset-") &&
    !workspace.datasets.some(
      (dataset) => dataset.unique_id === input.datasetMfid
    )
  ) {
    throw new CrucibleResponseError(404)
  }
  const existing = fixtureDatasetFiles(input.datasetMfid, scenario)
  if (input.replace) {
    const target = existing.find(
      (file) => file.mfid === input.replace?.fileMfid
    )
    if (!target) throw new CrucibleResponseError(404)
    if (target.storage_backend !== "gcs") throw new CrucibleResponseError(400)
    if (target.etag !== input.replace.etag) return { state: "file_changed" }
  } else {
    const conflict = existing.find((file) => file.filename === input.filename)
    if (conflict?.etag) {
      return {
        etag: conflict.etag,
        fileMfid: conflict.mfid,
        state: "filename_exists",
      }
    }
  }

  const uploadId = `fixture-upload-${crypto.randomUUID()}`
  fixtureUploadSessions.set(fixtureUploadKey(input.datasetMfid, uploadId), {
    acknowledgedPartNumbers: [],
    datasetMfid: input.datasetMfid,
    filename: input.filename,
    partSize: fixturePartSize(input.size),
    ...(input.replace ? { replaceFileMfid: input.replace.fileMfid } : {}),
    size: input.size,
    state: "uploading",
  })
  return { partSize: fixturePartSize(input.size), state: "uploading", uploadId }
}

export async function signWorkspaceUploadParts(
  input: {
    datasetMfid: string
    parts: { crc32cBase64: string; partNumber: number }[]
    uploadId: string
  },
  requestSignal?: AbortSignal
): Promise<WorkspaceUploadSignedPart[]> {
  const configuration = readUploadConfiguration()
  if (configuration.mode === "api") {
    const result = await apiUploadClient(configuration).POST(
      "/datasets/{dataset_mfid}/upload/multipart/{upload_id}/parts",
      {
        body: {
          parts: input.parts.map((part) => ({
            crc32c: part.crc32cBase64,
            part_number: part.partNumber,
          })),
        },
        params: {
          path: { dataset_mfid: input.datasetMfid, upload_id: input.uploadId },
        },
        signal: crucibleRequestSignal(requestSignal),
      }
    )
    if (!result.data) throw new CrucibleResponseError(result.response)
    const signed = apiSignedPartsSchema.safeParse(result.data)
    if (!signed.success) {
      throw new CrucibleContractError("multipart-parts", signed.error.issues)
    }
    return signed.data.parts.map((part) => ({
      headers: Object.fromEntries(
        Object.entries(part.headers).filter(
          ([name]) => name.toLowerCase() !== "content-length"
        )
      ),
      partNumber: part.part_number,
      url: part.url,
    }))
  }

  const session = fixtureUploadSessions.get(
    fixtureUploadKey(input.datasetMfid, input.uploadId)
  )
  if (!session) throw new CrucibleResponseError(404)
  if (session.state === "aborted" || session.state === "failed") {
    throw new CrucibleResponseError(409)
  }
  session.acknowledgedPartNumbers = [
    ...new Set([
      ...session.acknowledgedPartNumbers,
      ...input.parts.map((part) => part.partNumber),
    ]),
  ].sort((first, second) => first - second)
  return input.parts.map((part) => ({
    headers: {},
    partNumber: part.partNumber,
    url: `/fixture-uploads?session=${input.uploadId}&part=${part.partNumber}`,
  }))
}

export async function readWorkspaceUploadSession(
  input: {
    datasetMfid: string
    uploadId: string
  },
  requestSignal?: AbortSignal
): Promise<WorkspaceUploadSession> {
  const configuration = readUploadConfiguration()
  if (configuration.mode === "api") {
    const client = apiUploadClient(configuration)
    const acknowledged = new Set<number>()
    let marker = 0
    for (let page = 0; page < MAX_STATUS_PAGES; page += 1) {
      const result = await client.GET(
        "/datasets/{dataset_mfid}/upload/multipart/{upload_id}",
        {
          params: {
            path: {
              dataset_mfid: input.datasetMfid,
              upload_id: input.uploadId,
            },
            query: { limit: STATUS_PAGE_LIMIT, part_number_marker: marker },
          },
          signal: crucibleRequestSignal(requestSignal),
        }
      )
      if (!result.data) throw new CrucibleResponseError(result.response)
      const status = parseApiStatus(result.data)
      for (const part of status.parts) acknowledged.add(part.part_number)
      const next = status.next_part_number_marker ?? null
      if (next !== null && next > marker && status.parts.length > 0) {
        marker = next
        continue
      }
      return {
        acknowledgedPartNumbers: [...acknowledged].sort(
          (first, second) => first - second
        ),
        datasetMfid: input.datasetMfid,
        failureCode: status.failure_code ?? undefined,
        file: status.existing_file ?? undefined,
        partSize: status.part_size ?? undefined,
        state: apiUploadState(status.state),
        uploadId: input.uploadId,
      }
    }
    throw new Error("The upload status listed more parts than allowed.")
  }

  const session = fixtureUploadSessions.get(
    fixtureUploadKey(input.datasetMfid, input.uploadId)
  )
  if (!session) throw new CrucibleResponseError(404)
  return {
    acknowledgedPartNumbers: [...session.acknowledgedPartNumbers],
    datasetMfid: input.datasetMfid,
    file: session.file,
    partSize: session.partSize,
    state: session.state,
    uploadId: input.uploadId,
  }
}

export async function completeWorkspaceUpload(
  input: {
    crc32cBase64: string
    datasetMfid: string
    sha256Hex: string
    uploadId: string
  },
  requestSignal?: AbortSignal
): Promise<WorkspaceDatasetFile> {
  const configuration = readUploadConfiguration()
  if (configuration.mode === "api") {
    const result = await apiUploadClient(configuration).POST(
      "/datasets/{dataset_mfid}/upload/multipart/complete",
      {
        body: {
          crc32c: input.crc32cBase64,
          sha256_hash: input.sha256Hex,
          upload_id: input.uploadId,
        },
        params: { path: { dataset_mfid: input.datasetMfid } },
        signal: crucibleRequestSignal(requestSignal, COMPLETION_TIMEOUT_MS),
      }
    )
    if (!result.data) {
      throw new CrucibleResponseError(result.response, result.error)
    }
    const file = apiDatasetFileSchema.safeParse(result.data)
    if (!file.success) {
      throw new CrucibleContractError("multipart-complete", file.error.issues)
    }
    return file.data
  }

  const session = fixtureUploadSessions.get(
    fixtureUploadKey(input.datasetMfid, input.uploadId)
  )
  if (!session) throw new CrucibleResponseError(404)
  if (session.state === "completed" && session.file) return session.file
  if (session.state === "uploading") {
    if (session.replaceFileMfid) {
      const target = fixtureDatasetFiles(input.datasetMfid).find(
        (file) => file.mfid === session.replaceFileMfid
      )
      if (!target) throw new CrucibleResponseError(404)
      const replaced = {
        ...target,
        etag: fixtureEtag(),
        sha256_hash: input.sha256Hex,
        size: session.size,
      }
      session.state = "completed"
      session.file = replaced
      const uploaded = fixtureUploadedFiles.get(input.datasetMfid) ?? []
      if (uploaded.some((file) => file.mfid === replaced.mfid)) {
        fixtureUploadedFiles.set(
          input.datasetMfid,
          uploaded.map((file) =>
            file.mfid === replaced.mfid ? replaced : file
          )
        )
      } else {
        fixtureReplacedFiles.set(replaced.mfid, replaced)
      }
      return replaced
    }
    session.state = "completed"
    session.file = {
      access_note: null,
      dataset_id: 0,
      dataset_mfid: input.datasetMfid,
      etag: fixtureEtag(),
      filename: session.filename,
      mfid: `fixture-file-${crypto.randomUUID()}`,
      sha256_hash: input.sha256Hex,
      size: session.size,
      storage_backend: "gcs",
      storage_path: null,
    }
    fixtureUploadedFiles.set(input.datasetMfid, [
      ...(fixtureUploadedFiles.get(input.datasetMfid) ?? []),
      session.file,
    ])
    return session.file
  }
  throw new CrucibleResponseError(409)
}

export async function abortWorkspaceUpload(
  input: {
    datasetMfid: string
    uploadId: string
  },
  requestSignal?: AbortSignal
): Promise<void> {
  const configuration = readUploadConfiguration()
  if (configuration.mode === "api") {
    const result = await apiUploadClient(configuration).DELETE(
      "/datasets/{dataset_mfid}/upload/multipart/{upload_id}",
      {
        params: {
          path: { dataset_mfid: input.datasetMfid, upload_id: input.uploadId },
        },
        signal: crucibleRequestSignal(requestSignal),
      }
    )
    if (!result.response.ok) throw new CrucibleResponseError(result.response)
    return
  }

  const session = fixtureUploadSessions.get(
    fixtureUploadKey(input.datasetMfid, input.uploadId)
  )
  if (!session) throw new CrucibleResponseError(404)
  session.state = "aborted"
  fixtureUploadSessions.delete(
    fixtureUploadKey(input.datasetMfid, input.uploadId)
  )
}
