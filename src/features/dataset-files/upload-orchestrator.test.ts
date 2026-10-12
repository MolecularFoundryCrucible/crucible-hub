import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  abortWorkspaceDatasetUpload,
  completeWorkspaceDatasetUpload,
  initializeWorkspaceDatasetUpload,
  readWorkspaceDatasetUpload,
  signWorkspaceDatasetUploadParts,
} from "@/data/crucible/uploads.functions"

import { UploadEmptyFileError, uploadDatasetFile } from "./upload-orchestrator"

vi.mock("@/data/crucible/uploads.functions", () => ({
  abortWorkspaceDatasetUpload: vi.fn(),
  completeWorkspaceDatasetUpload: vi.fn(),
  initializeWorkspaceDatasetUpload: vi.fn(),
  readWorkspaceDatasetUpload: vi.fn(),
  signWorkspaceDatasetUploadParts: vi.fn(),
}))

const ok = <T>(data: T) => ({ data, status: "ok" as const })

function upload(file: File) {
  return uploadDatasetFile({
    datasetMfid: "dataset-1",
    file,
    filename: file.name,
    onProgress: () => undefined,
    signal: new AbortController().signal,
  })
}

describe("dataset file upload orchestration", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(initializeWorkspaceDatasetUpload).mockResolvedValue(
      ok({ state: "uploading", uploadId: "upload-1" })
    )
    vi.mocked(readWorkspaceDatasetUpload).mockResolvedValue(
      ok({
        acknowledgedPartNumbers: [],
        datasetMfid: "dataset-1",
        state: "uploading",
        uploadId: "upload-1",
      })
    )
    vi.mocked(signWorkspaceDatasetUploadParts).mockResolvedValue(
      ok([
        {
          headers: { "x-goog-hash": "crc32c=AAAAAA==" },
          partNumber: 1,
          url: "https://uploads.crucible.invalid/part-1",
        },
      ])
    )
    vi.mocked(abortWorkspaceDatasetUpload).mockResolvedValue(ok(undefined))
  })

  it("rejects empty files before starting a session", async () => {
    await expect(upload(new File([], "empty.dat"))).rejects.toBeInstanceOf(
      UploadEmptyFileError
    )
    expect(initializeWorkspaceDatasetUpload).not.toHaveBeenCalled()
  })

  it("retries completion while storage is temporarily unavailable", async () => {
    vi.mocked(completeWorkspaceDatasetUpload)
      .mockResolvedValueOnce({
        error: {
          correlationId: "request-1",
          kind: "upstream",
          message: "Crucible is temporarily unavailable.",
          retryable: true,
          retryAfterSeconds: 0,
        },
        status: "error",
      })
      .mockResolvedValueOnce(
        ok({
          dataset_id: 1,
          dataset_mfid: "dataset-1",
          filename: "data.dat",
          mfid: "file-1",
          sha256_hash: "a".repeat(64),
          size: 3,
          storage_backend: "gcs",
        })
      )
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200 }))
    )

    await expect(upload(new File(["abc"], "data.dat"))).resolves.toMatchObject({
      mfid: "file-1",
    })
    expect(completeWorkspaceDatasetUpload).toHaveBeenCalledTimes(2)
    expect(abortWorkspaceDatasetUpload).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it("abandons the session when the upload fails", async () => {
    vi.mocked(completeWorkspaceDatasetUpload).mockResolvedValue({
      error: {
        correlationId: "request-1",
        kind: "conflict",
        message: "The upload checksum did not match.",
        retryable: false,
      },
      status: "error",
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200 }))
    )

    await expect(upload(new File(["abc"], "data.dat"))).rejects.toThrow(
      "The upload checksum did not match."
    )
    expect(abortWorkspaceDatasetUpload).toHaveBeenCalledWith({
      data: { datasetMfid: "dataset-1", uploadId: "upload-1" },
    })
    vi.unstubAllGlobals()
  })
})
