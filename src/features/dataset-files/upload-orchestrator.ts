import {
  computeUploadDigests,
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

export type UploadPhase =
  | "hashing"
  | "initiating"
  | "uploading"
  | "completing"
  | "done"
  | "failed"
  | "aborted"

export type UploadProgress = {
  bytes: number
  phase: UploadPhase
}

const DEFAULT_COMPLETION_RETRY_SECONDS = 5
const MAX_COMPLETION_ATTEMPTS = 3

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
  scenario?: FixtureScenario
  signal: AbortSignal
}): Promise<WorkspaceDatasetFile> {
  const { datasetMfid, file, filename, onProgress, scenario, signal } = options

  const filenameIssues = validateUploadFilename(filename)
  if (filenameIssues.length > 0) {
    throw new UploadFilenameError(filenameIssues)
  }

  if (file.size === 0) {
    throw new UploadEmptyFileError()
  }

  const parts = planUploadParts(file.size)
  const digests = await computeUploadDigests(
    file,
    parts,
    (bytes) => onProgress({ bytes, phase: "hashing" }),
    signal
  )
  signal.throwIfAborted()

  const initiation = unwrapHubResult(
    await initializeWorkspaceDatasetUpload({
      data: {
        datasetMfid,
        filename,
        idempotencyKey: crypto.randomUUID(),
        scenario,
        size: file.size,
      },
      signal,
    })
  )
  if ("file" in initiation) {
    onProgress({ bytes: file.size, phase: "done" })
    return initiation.file
  }
  const uploadId = initiation.uploadId
  let uploadedBytes = 0
  onProgress({ bytes: 0, phase: "uploading" })

  try {
    if (initiation.state !== "uploading") {
      throw new Error("The upload could not be started.")
    }

    await runUploadParts({
      file,
      parts,
      signatures: digests.partCrc32cBase64,
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
        putPart: async (part, signed, body, partSignal) => {
          const response = await fetch(signed.url, {
            body,
            headers: signed.headers,
            method: "PUT",
            signal: partSignal,
          })
          if (response.ok) return
          await response.arrayBuffer()
          const retryAfterSeconds = readRetryAfterSeconds(response.headers)
          throw Object.assign(
            new Error(`Part ${part.partNumber} could not be transferred.`),
            retryAfterSeconds === undefined ? {} : { retryAfterSeconds }
          )
        },
      },
      wait: (milliseconds) => wait(milliseconds, signal),
      onPartUploaded: (partNumber) => {
        const part = parts.find(
          (candidate) => candidate.partNumber === partNumber
        )
        uploadedBytes += part ? part.end - part.start : 0
        onProgress({ bytes: uploadedBytes, phase: "uploading" })
      },
    })

    onProgress({ bytes: file.size, phase: "completing" })
    const completed = await completeWithRetry(
      () =>
        completeWorkspaceDatasetUpload({
          data: {
            crc32cBase64: digests.crc32cBase64,
            datasetMfid,
            sha256Hex: digests.sha256Hex,
            uploadId,
          },
          signal,
        }),
      signal
    )
    onProgress({ bytes: file.size, phase: "done" })
    return completed
  } catch (error) {
    await abortWorkspaceDatasetUpload({
      data: { datasetMfid, uploadId },
    }).catch(() => undefined)
    throw error
  }
}
