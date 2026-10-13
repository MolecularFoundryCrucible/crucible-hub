import {
  computeUploadDigests,
  createUploadPartChecksums,
  planUploadParts,
  runUploadParts,
  UPLOAD_PART_SIZE,
  validateUploadFilename,
} from "@/data/crucible/uploads"
import {
  abortWorkspaceDatasetUpload,
  completeWorkspaceDatasetUpload,
  initializeWorkspaceDatasetUpload,
  readWorkspaceDatasetUpload,
  signWorkspaceDatasetUploadParts,
} from "@/data/crucible/uploads.functions"
import { HubApiClientError, unwrapHubResult } from "@/data/crucible/result"
import type { HubResult } from "@/data/crucible/result"
import { readRetryAfterSeconds } from "@/lib/retry-after"
import type { FixtureScenario } from "@/data/crucible/fixture-scenarios"
import type { WorkspaceDatasetFile } from "@/data/crucible/workspace-source"

export type UploadPhase = "preparing" | "uploading" | "completing" | "done"

export type UploadProgress = {
  phase: UploadPhase
  preparedBytes: number
  uploadedBytes: number
}

const PROGRESS_INTERVAL_MS = 250
const DEFAULT_COMPLETION_RETRY_SECONDS = 5
const MAX_COMPLETION_ATTEMPTS = 3

export class UploadFilenameExistsError extends Error {
  constructor(
    readonly fileMfid: string,
    readonly etag: string
  ) {
    super("A file with this name was added to the dataset.")
    this.name = "UploadFilenameExistsError"
  }
}

export class UploadReplaceTargetChangedError extends Error {
  constructor() {
    super("The existing file changed since you chose to replace it.")
    this.name = "UploadReplaceTargetChangedError"
  }
}

export class UploadEmptyFileError extends Error {
  constructor() {
    super("Empty files cannot be uploaded.")
    this.name = "UploadEmptyFileError"
  }
}

export class UploadFilenameError extends Error {
  constructor(issues: readonly string[]) {
    super(issues[0] ?? "The file name is invalid.")
    this.name = "UploadFilenameError"
  }
}

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort)
      resolve()
    }, milliseconds)
    signal.addEventListener("abort", onAbort, { once: true })
  })
}

function partTransferError(partNumber: number, retryAfter: string | null) {
  const retryAfterSeconds = readRetryAfterSeconds(
    new Headers(retryAfter === null ? {} : { "Retry-After": retryAfter })
  )
  return Object.assign(
    new Error(`Part ${partNumber} could not be transferred.`),
    retryAfterSeconds === undefined ? {} : { retryAfterSeconds }
  )
}

export function putUploadPart(options: {
  body: Blob
  headers: Readonly<Record<string, string>>
  onProgress?: (loadedBytes: number) => void
  partNumber: number
  signal?: AbortSignal
  url: string
}): Promise<void> {
  const { body, headers, onProgress, partNumber, signal, url } = options
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    const request = new XMLHttpRequest()
    const abort = () => request.abort()
    const settle = () => signal?.removeEventListener("abort", abort)
    request.open("PUT", url)
    for (const [name, value] of Object.entries(headers)) {
      request.setRequestHeader(name, value)
    }
    request.upload.onprogress = (event) => onProgress?.(event.loaded)
    request.onload = () => {
      settle()
      if (request.status >= 200 && request.status < 300) resolve()
      else {
        reject(
          partTransferError(
            partNumber,
            request.getResponseHeader("Retry-After")
          )
        )
      }
    }
    request.onerror = () => {
      settle()
      reject(partTransferError(partNumber, null))
    }
    request.onabort = () => {
      settle()
      reject(
        signal?.reason ??
          new DOMException("The upload was cancelled.", "AbortError")
      )
    }
    signal?.addEventListener("abort", abort, { once: true })
    request.send(body)
  })
}

async function completeWithRetry(
  complete: () => Promise<HubResult<WorkspaceDatasetFile>>,
  signal: AbortSignal
): Promise<WorkspaceDatasetFile> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return unwrapHubResult(await complete())
    } catch (error) {
      if (
        attempt >= MAX_COMPLETION_ATTEMPTS ||
        !(error instanceof HubApiClientError) ||
        !error.details.retryable
      ) {
        throw error
      }
      await wait(
        (error.details.retryAfterSeconds ?? DEFAULT_COMPLETION_RETRY_SECONDS) *
          1000,
        signal
      )
    }
  }
}

export async function uploadDatasetFile(options: {
  datasetMfid: string
  file: File
  filename: string
  onProgress: (progress: UploadProgress) => void
  replace?: { etag: string; fileMfid: string }
  scenario?: FixtureScenario
  signal: AbortSignal
}): Promise<WorkspaceDatasetFile> {
  const { datasetMfid, file, filename, onProgress, replace, scenario, signal } =
    options

  const filenameIssues = validateUploadFilename(filename)
  if (filenameIssues.length > 0) {
    throw new UploadFilenameError(filenameIssues)
  }

  if (file.size === 0) {
    throw new UploadEmptyFileError()
  }

  const parts = planUploadParts(file.size)
  const partSizes = new Map(
    parts.map((part) => [part.partNumber, part.end - part.start])
  )
  const partLoaded = new Map<number, number>()
  let preparedBytes = 0
  let completedBytes = 0
  let phase: UploadPhase = "preparing"
  let lastReport = 0
  const report = (force = false) => {
    const now = performance.now()
    if (!force && now - lastReport < PROGRESS_INTERVAL_MS) return
    lastReport = now
    let uploadedBytes = completedBytes
    for (const loaded of partLoaded.values()) uploadedBytes += loaded
    if (phase === "preparing" && uploadedBytes > 0) phase = "uploading"
    onProgress({ phase, preparedBytes, uploadedBytes })
  }
  report(true)

  const initiation = unwrapHubResult(
    await initializeWorkspaceDatasetUpload({
      data: {
        datasetMfid,
        filename,
        idempotencyKey: crypto.randomUUID(),
        ...(replace ? { replace } : {}),
        scenario,
        size: file.size,
      },
      signal,
    })
  )
  if (initiation.state === "filename_exists") {
    throw new UploadFilenameExistsError(initiation.fileMfid, initiation.etag)
  }
  if (initiation.state === "file_changed") {
    throw new UploadReplaceTargetChangedError()
  }
  if ("file" in initiation) {
    onProgress({
      phase: "done",
      preparedBytes: file.size,
      uploadedBytes: file.size,
    })
    return initiation.file
  }
  const uploadId = initiation.uploadId
  const checksums = createUploadPartChecksums()
  const preparation = new AbortController()
  const stopPreparation = () => preparation.abort(signal.reason)
  signal.addEventListener("abort", stopPreparation, { once: true })
  const digests = computeUploadDigests(
    file,
    parts,
    (bytes) => {
      preparedBytes = bytes
      report()
    },
    preparation.signal,
    (partNumber, crc32cBase64) => checksums.resolve(partNumber, crc32cBase64)
  )
  digests.catch((error: unknown) => checksums.fail(error))

  try {
    if (initiation.state !== "uploading") {
      throw new Error("The upload could not be started.")
    }

    await runUploadParts({
      file,
      parts,
      signatures: checksums,
      signal,
      transport: {
        readAcknowledgedPartNumbers: async () => {
          const current = unwrapHubResult(
            await readWorkspaceDatasetUpload({
              data: { datasetMfid, uploadId },
              signal,
            })
          )
          if (current.state !== "uploading") {
            throw new Error(
              current.failureCode
                ? `The upload failed (${current.failureCode}).`
                : "The upload is no longer accepting parts."
            )
          }
          if (
            current.partSize !== undefined &&
            current.partSize !== UPLOAD_PART_SIZE
          ) {
            throw new Error("The upload session uses an unsupported part size.")
          }
          return new Set(current.acknowledgedPartNumbers)
        },
        signParts: async (signatures) => {
          const signed = unwrapHubResult(
            await signWorkspaceDatasetUploadParts({
              data: { datasetMfid, parts: [...signatures], uploadId },
              signal,
            })
          )
          return new Map(
            signed.map((part) => [
              part.partNumber,
              { headers: part.headers, url: part.url },
            ])
          )
        },
        putPart: (part, signed, body, partSignal, onPartProgress) =>
          putUploadPart({
            body,
            headers: signed.headers,
            onProgress: onPartProgress,
            partNumber: part.partNumber,
            signal: partSignal,
            url: signed.url,
          }),
      },
      wait: (milliseconds) => wait(milliseconds, signal),
      onPartProgress: (partNumber, loadedBytes) => {
        partLoaded.set(partNumber, loadedBytes)
        report()
      },
      onPartUploaded: (partNumber) => {
        partLoaded.delete(partNumber)
        completedBytes += partSizes.get(partNumber) ?? 0
        report()
      },
    })

    const { crc32cBase64, sha256Hex } = await digests
    phase = "completing"
    report(true)
    const completed = await completeWithRetry(
      () =>
        completeWorkspaceDatasetUpload({
          data: { crc32cBase64, datasetMfid, sha256Hex, uploadId },
          signal,
        }),
      signal
    )
    phase = "done"
    report(true)
    return completed
  } catch (error) {
    preparation.abort()
    await digests.catch(() => undefined)
    await abortWorkspaceDatasetUpload({
      data: { datasetMfid, uploadId },
    }).catch(() => undefined)
    throw error
  } finally {
    signal.removeEventListener("abort", stopPreparation)
  }
}
