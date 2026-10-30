import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  abortWorkspaceDatasetUpload,
  completeWorkspaceDatasetUpload,
  initializeWorkspaceDatasetUpload,
  readWorkspaceDatasetUpload,
  signWorkspaceDatasetUploadParts,
} from "@/data/crucible/uploads.functions"

import { uploadDatasetFile } from "./upload-orchestrator"
import type { UploadProgress } from "./upload-orchestrator"

vi.mock("@/data/crucible/uploads.functions", () => ({
  abortWorkspaceDatasetUpload: vi.fn(),
  completeWorkspaceDatasetUpload: vi.fn(),
  initializeWorkspaceDatasetUpload: vi.fn(),
  readWorkspaceDatasetUpload: vi.fn(),
  signWorkspaceDatasetUploadParts: vi.fn(),
}))

const ok = <T>(data: T) => ({ data, status: "ok" as const })

class FakeUploadRequest {
  static sent: { headers: Record<string, string>; url: string }[] = []
  headers: Record<string, string> = {}
  onabort: (() => void) | null = null
  onerror: (() => void) | null = null
  onload: (() => void) | null = null
  status = 0
  upload: { onprogress: ((event: { loaded: number }) => void) | null } = {
    onprogress: null,
  }
  url = ""
  abort() {
    this.onabort?.()
  }
  getResponseHeader() {
    return null
  }
  open(_method: string, url: string) {
    this.url = url
  }
  send(body: Blob) {
    FakeUploadRequest.sent.push({ headers: this.headers, url: this.url })
    setTimeout(() => {
      this.upload.onprogress?.({ loaded: body.size })
      this.status = 200
      this.onload?.()
    })
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value
  }
}

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
      ok({
        partSize: 64 * 1024 * 1024,
        state: "uploading",
        uploadId: "upload-1",
      })
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

  it("completes an empty file without uploading parts", async () => {
    vi.mocked(initializeWorkspaceDatasetUpload).mockResolvedValue(
      ok({ partSize: 0, state: "uploading", uploadId: "upload-1" })
    )
    const stored = { filename: "empty.dat", mfid: "file-1", size: 0 }
    vi.mocked(completeWorkspaceDatasetUpload).mockResolvedValue(
      ok(stored) as never
    )
    FakeUploadRequest.sent = []
    vi.stubGlobal("XMLHttpRequest", FakeUploadRequest)

    await expect(upload(new File([], "empty.dat"))).resolves.toEqual(stored)
    expect(initializeWorkspaceDatasetUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ size: 0 }),
      })
    )
    expect(signWorkspaceDatasetUploadParts).not.toHaveBeenCalled()
    expect(FakeUploadRequest.sent).toEqual([])
    expect(completeWorkspaceDatasetUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          crc32cBase64: "AAAAAA==",
          sha256Hex:
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        }),
      })
    )
    vi.unstubAllGlobals()
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
    vi.stubGlobal("XMLHttpRequest", FakeUploadRequest)

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
    vi.stubGlobal("XMLHttpRequest", FakeUploadRequest)

    await expect(upload(new File(["abc"], "data.dat"))).rejects.toThrow(
      "The upload checksum did not match."
    )
    expect(abortWorkspaceDatasetUpload).toHaveBeenCalledWith({
      data: { datasetMfid: "dataset-1", uploadId: "upload-1" },
    })
    vi.unstubAllGlobals()
  })

  it("reports progress and forwards the signed part headers", async () => {
    FakeUploadRequest.sent = []
    vi.mocked(completeWorkspaceDatasetUpload).mockResolvedValue(
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
    vi.stubGlobal("XMLHttpRequest", FakeUploadRequest)
    const progress: UploadProgress[] = []

    await uploadDatasetFile({
      datasetMfid: "dataset-1",
      file: new File(["abc"], "data.dat"),
      filename: "data.dat",
      onProgress: (next) => progress.push(next),
      signal: new AbortController().signal,
    })

    expect(progress[0]).toEqual({
      phase: "preparing",
      preparedBytes: 0,
      uploadedBytes: 0,
    })
    expect(progress.map((next) => next.phase)).toContain("completing")
    expect(progress.at(-1)).toEqual({
      phase: "done",
      preparedBytes: 3,
      uploadedBytes: 3,
    })
    expect(FakeUploadRequest.sent).toEqual([
      {
        headers: { "x-goog-hash": "crc32c=AAAAAA==" },
        url: "https://uploads.crucible.invalid/part-1",
      },
    ])
    vi.unstubAllGlobals()
  })

  it("plans parts from the part size the session returns", async () => {
    FakeUploadRequest.sent = []
    vi.mocked(initializeWorkspaceDatasetUpload).mockResolvedValue(
      ok({ partSize: 2, state: "uploading", uploadId: "upload-1" })
    )
    vi.mocked(readWorkspaceDatasetUpload).mockResolvedValue(
      ok({
        acknowledgedPartNumbers: [],
        datasetMfid: "dataset-1",
        partSize: 2,
        state: "uploading",
        uploadId: "upload-1",
      })
    )
    vi.mocked(signWorkspaceDatasetUploadParts).mockImplementation(
      async ({ data }) =>
        ok(
          data.parts.map((part) => ({
            headers: {},
            partNumber: part.partNumber,
            url: `https://uploads.crucible.invalid/part-${part.partNumber}`,
          }))
        )
    )
    vi.mocked(completeWorkspaceDatasetUpload).mockResolvedValue(
      ok({
        dataset_id: 1,
        dataset_mfid: "dataset-1",
        filename: "data.dat",
        mfid: "file-1",
        sha256_hash: "a".repeat(64),
        size: 5,
        storage_backend: "gcs",
      })
    )
    vi.stubGlobal("XMLHttpRequest", FakeUploadRequest)

    await upload(new File(["abcde"], "data.dat"))

    expect(FakeUploadRequest.sent.map((sent) => sent.url).sort()).toEqual([
      "https://uploads.crucible.invalid/part-1",
      "https://uploads.crucible.invalid/part-2",
      "https://uploads.crucible.invalid/part-3",
    ])
    vi.unstubAllGlobals()
  })

  it("abandons a session whose part size cannot be planned", async () => {
    vi.mocked(initializeWorkspaceDatasetUpload).mockResolvedValue(
      ok({ partSize: 0, state: "uploading", uploadId: "upload-1" })
    )

    await expect(upload(new File(["abc"], "data.dat"))).rejects.toThrow()
    expect(abortWorkspaceDatasetUpload).toHaveBeenCalledWith({
      data: { datasetMfid: "dataset-1", uploadId: "upload-1" },
    })
    expect(signWorkspaceDatasetUploadParts).not.toHaveBeenCalled()
  })
})
