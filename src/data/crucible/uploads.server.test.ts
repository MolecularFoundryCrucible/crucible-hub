import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import {
  abortWorkspaceUpload,
  completeWorkspaceUpload,
  fixtureUploadedFilesFor,
  initializeWorkspaceUploadSession,
  readWorkspaceUploadSession,
  signWorkspaceUploadParts,
} from "@/data/crucible/uploads.server"

const datasetMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z7"

function stubApiMode() {
  vi.stubEnv("NODE_ENV", "development")
  vi.stubEnv("HUB_DATA_SOURCE", "api")
  vi.stubEnv("HUB_UPLOADS_ENABLED", "true")
  vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
  vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
}

describe("dataset upload transport", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("simulates a working upload session in fixture mode", async () => {
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")

    const initiation = await initializeWorkspaceUploadSession({
      datasetMfid,
      filename: "runs/run-001/data.csv",
      size: 128,
    })
    if (!("uploadId" in initiation)) throw new Error("Expected a session.")
    expect(initiation.state).toBe("uploading")

    const signed = await signWorkspaceUploadParts({
      datasetMfid,
      parts: [
        { crc32cBase64: "AAAAAA==", partNumber: 1 },
        { crc32cBase64: "AAAAAA==", partNumber: 2 },
      ],
      uploadId: initiation.uploadId,
    })
    expect(signed).toHaveLength(2)
    expect(signed[0].url).toBe(
      `/fixture-uploads?session=${initiation.uploadId}&part=1`
    )
    expect(signed[1].url).toBe(
      `/fixture-uploads?session=${initiation.uploadId}&part=2`
    )

    const acknowledged = await readWorkspaceUploadSession({
      datasetMfid,
      uploadId: initiation.uploadId,
    })
    expect(acknowledged.acknowledgedPartNumbers).toEqual([1, 2])

    const completed = await completeWorkspaceUpload({
      crc32cBase64: "AAAAAA==",
      datasetMfid,
      sha256Hex: "a".repeat(64),
      uploadId: initiation.uploadId,
    })
    expect(completed).toMatchObject({
      filename: "runs/run-001/data.csv",
      sha256_hash: "a".repeat(64),
      size: 128,
    })
    expect(
      fixtureUploadedFilesFor(datasetMfid).map((file) => file.filename)
    ).toEqual(["runs/run-001/data.csv"])

    const reread = await completeWorkspaceUpload({
      crc32cBase64: "AAAAAA==",
      datasetMfid,
      sha256Hex: "a".repeat(64),
      uploadId: initiation.uploadId,
    })
    expect(reread.mfid).toBe(completed.mfid)
  })

  it("aborts a session and rejects further part signing", async () => {
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")

    const initiation = await initializeWorkspaceUploadSession({
      datasetMfid,
      filename: "runs/run-002/data.csv",
      size: 64,
    })
    if (!("uploadId" in initiation)) throw new Error("Expected a session.")
    await abortWorkspaceUpload({
      datasetMfid,
      uploadId: initiation.uploadId,
    })
    await expect(
      readWorkspaceUploadSession({
        datasetMfid,
        uploadId: initiation.uploadId,
      })
    ).rejects.toThrow()

    await expect(
      signWorkspaceUploadParts({
        datasetMfid,
        parts: [{ crc32cBase64: "AAAAAA==", partNumber: 1 }],
        uploadId: initiation.uploadId,
      })
    ).rejects.toThrow()
  })

  it("rejects sessions for unknown datasets or uploads", async () => {
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")

    await expect(
      initializeWorkspaceUploadSession({
        datasetMfid: "fixture-missing-dataset",
        filename: "data.csv",
        size: 1,
      })
    ).rejects.toThrow()
    await expect(
      readWorkspaceUploadSession({
        datasetMfid,
        uploadId: "fixture-upload-missing",
      })
    ).rejects.toThrow()
  })

  it("fails closed for API-mode servers until uploads are enabled", async () => {
    stubApiMode()
    vi.stubEnv("HUB_UPLOADS_ENABLED", "")

    await expect(
      initializeWorkspaceUploadSession({
        datasetMfid,
        filename: "data.csv",
        size: 1,
      })
    ).rejects.toThrow("Dataset uploads are not enabled")
  })

  it("initiates an API session with an idempotency key", async () => {
    stubApiMode()
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        return crucibleApiResponse({
          parts: [],
          state: "uploading",
          upload_id: "upload-1",
        })
      })
    )

    await expect(
      initializeWorkspaceUploadSession({
        datasetMfid,
        filename: "runs/data.csv",
        idempotencyKey: "4b1d5c6e-2f3a-4b5c-8d9e-0f1a2b3c4d5e",
        size: 128,
      })
    ).resolves.toEqual({ state: "uploading", uploadId: "upload-1" })
    expect(new URL(requests[0].url).pathname).toBe(
      `/datasets/${datasetMfid}/upload/multipart/initiate`
    )
    expect(requests[0].headers.get("idempotency-key")).toBe(
      "4b1d5c6e-2f3a-4b5c-8d9e-0f1a2b3c4d5e"
    )
    await expect(requests[0].json()).resolves.toEqual({
      filename: "runs/data.csv",
      size: 128,
    })
  })

  it("replaces a file through its own initiate route with If-Match", async () => {
    stubApiMode()
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        return crucibleApiResponse({
          parts: [],
          state: "uploading",
          upload_id: "upload-2",
        })
      })
    )

    await expect(
      initializeWorkspaceUploadSession({
        datasetMfid,
        filename: "runs/data.csv",
        idempotencyKey: "4b1d5c6e-2f3a-4b5c-8d9e-0f1a2b3c4d5e",
        replace: { etag: '"abc"', fileMfid: "file-1" },
        size: 256,
      })
    ).resolves.toEqual({ state: "uploading", uploadId: "upload-2" })
    expect(new URL(requests[0].url).pathname).toBe(
      "/files/file-1/upload/multipart/initiate"
    )
    expect(requests[0].headers.get("if-match")).toBe('"abc"')
    expect(requests[0].headers.get("idempotency-key")).toBe(
      "4b1d5c6e-2f3a-4b5c-8d9e-0f1a2b3c4d5e"
    )
    await expect(requests[0].json()).resolves.toEqual({ size: 256 })
  })

  it("returns actionable results for an existing name or a changed file", async () => {
    stubApiMode()
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        crucibleApiResponse(
          {
            detail: {
              code: "filename_exists",
              etag: '"abc"',
              file_mfid: "file-1",
              message: "Filename already exists",
            },
          },
          { status: 409 }
        )
      )
    )
    await expect(
      initializeWorkspaceUploadSession({
        datasetMfid,
        filename: "runs/data.csv",
        size: 128,
      })
    ).resolves.toEqual({
      etag: '"abc"',
      fileMfid: "file-1",
      state: "filename_exists",
    })

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        crucibleApiResponse(
          { detail: { code: "etag_mismatch", etag: '"new"' } },
          { status: 412 }
        )
      )
    )
    await expect(
      initializeWorkspaceUploadSession({
        datasetMfid,
        filename: "runs/data.csv",
        replace: { etag: '"abc"', fileMfid: "file-1" },
        size: 128,
      })
    ).resolves.toEqual({ state: "file_changed" })

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        crucibleApiResponse(
          { detail: { code: "replace_in_progress", upload_id: "u" } },
          { status: 409 }
        )
      )
    )
    await expect(
      initializeWorkspaceUploadSession({
        datasetMfid,
        filename: "runs/data.csv",
        replace: { etag: '"abc"', fileMfid: "file-1" },
        size: 128,
      })
    ).rejects.toMatchObject({
      conflictCode: "replace_in_progress",
      status: 409,
    })
  })

  it("recognizes a replacement that could not be published", async () => {
    stubApiMode()
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        crucibleApiResponse(
          { detail: "Upload could not be published: file_changed" },
          { status: 409 }
        )
      )
    )
    await expect(
      completeWorkspaceUpload({
        crc32cBase64: "AAAAAA==",
        datasetMfid,
        sha256Hex: "0".repeat(64),
        uploadId: "upload-2",
      })
    ).rejects.toMatchObject({ conflictCode: "file_changed", status: 409 })
  })

  it("replaces a fixture file in place and keeps its MFID", async () => {
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")
    const existing = await initializeWorkspaceUploadSession({
      datasetMfid,
      filename: "operando-cycle-04.h5",
      size: 10,
    })
    expect(existing).toMatchObject({
      fileMfid: "01J6Y8N4Q2R7M9K3T5V0W1X2ZC",
      state: "filename_exists",
    })
    if (existing.state !== "filename_exists") return
    const replacement = await initializeWorkspaceUploadSession({
      datasetMfid,
      filename: "operando-cycle-04.h5",
      replace: { etag: existing.etag, fileMfid: existing.fileMfid },
      size: 10,
    })
    if (!("uploadId" in replacement)) throw new Error("expected a session")
    await signWorkspaceUploadParts({
      datasetMfid,
      parts: [{ crc32cBase64: "AAAAAA==", partNumber: 1 }],
      uploadId: replacement.uploadId,
    })
    const file = await completeWorkspaceUpload({
      crc32cBase64: "AAAAAA==",
      datasetMfid,
      sha256Hex: "1".repeat(64),
      uploadId: replacement.uploadId,
    })
    expect(file).toMatchObject({
      filename: "operando-cycle-04.h5",
      mfid: "01J6Y8N4Q2R7M9K3T5V0W1X2ZC",
      size: 10,
    })
    expect(file.etag).not.toBe(existing.etag)
    await expect(
      initializeWorkspaceUploadSession({
        datasetMfid,
        filename: "operando-cycle-04.h5",
        replace: { etag: existing.etag, fileMfid: existing.fileMfid },
        size: 10,
      })
    ).resolves.toEqual({ state: "file_changed" })
  })

  it("treats a deduplicated API initiation as a completed upload", async () => {
    stubApiMode()
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        crucibleApiResponse({
          existing_file: {
            dataset_id: 1,
            dataset_mfid: datasetMfid,
            filename: "runs/data.csv",
            mfid: "file-1",
            sha256_hash: "a".repeat(64),
            size: 128,
            storage_backend: "gcs",
          },
          parts: [],
          state: "completed",
          upload_id: null,
        })
      )
    )

    await expect(
      initializeWorkspaceUploadSession({
        datasetMfid,
        filename: "runs/data.csv",
        size: 128,
      })
    ).resolves.toMatchObject({ file: { mfid: "file-1" }, state: "completed" })
  })

  it("forwards every signed part header except Content-Length", async () => {
    stubApiMode()
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        crucibleApiResponse({
          parts: [
            {
              expires_at: "2026-10-12T12:15:00Z",
              headers: {
                "Content-Length": "67108864",
                "x-goog-content-length-range": "0,67108864",
                "x-goog-hash": "crc32c=AAAAAA==",
              },
              offset: 0,
              part_number: 1,
              size: 67108864,
              url: "https://storage.example.test/part-1",
            },
          ],
        })
      )
    )

    await expect(
      signWorkspaceUploadParts({
        datasetMfid,
        parts: [{ crc32cBase64: "AAAAAA==", partNumber: 1 }],
        uploadId: "upload-1",
      })
    ).resolves.toEqual([
      {
        headers: {
          "x-goog-content-length-range": "0,67108864",
          "x-goog-hash": "crc32c=AAAAAA==",
        },
        partNumber: 1,
        url: "https://storage.example.test/part-1",
      },
    ])
  })

  it("rejects signed part URLs that are not HTTPS", async () => {
    stubApiMode()
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        crucibleApiResponse({
          parts: [
            {
              headers: {},
              part_number: 1,
              url: "http://storage.example.test/part-1",
            },
          ],
        })
      )
    )

    await expect(
      signWorkspaceUploadParts({
        datasetMfid,
        parts: [{ crc32cBase64: "AAAAAA==", partNumber: 1 }],
        uploadId: "upload-1",
      })
    ).rejects.toThrow("did not match its contract")
  })

  it("follows part listing pages when reading API session status", async () => {
    stubApiMode()
    const markers: (string | null)[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        const marker = new URL(request.url).searchParams.get(
          "part_number_marker"
        )
        markers.push(marker)
        return crucibleApiResponse({
          next_part_number_marker: marker === "0" ? 2 : null,
          part_size: 67108864,
          parts:
            marker === "0"
              ? [
                  { etag: "a", part_number: 1, size: 67108864 },
                  { etag: "b", part_number: 2, size: 67108864 },
                ]
              : [{ etag: "c", part_number: 3, size: 10 }],
          state: "uploading",
          upload_id: "upload-1",
        })
      })
    )

    await expect(
      readWorkspaceUploadSession({ datasetMfid, uploadId: "upload-1" })
    ).resolves.toMatchObject({
      acknowledgedPartNumbers: [1, 2, 3],
      partSize: 67108864,
      state: "uploading",
    })
    expect(markers).toEqual(["0", "2"])
  })

  it("returns the verified file from API completion", async () => {
    stubApiMode()
    const file = {
      dataset_id: 1,
      dataset_mfid: datasetMfid,
      filename: "runs/data.csv",
      mfid: "file-1",
      sha256_hash: "a".repeat(64),
      size: 128,
      storage_backend: "gcs",
    }
    const requests: Request[] = []
    const responses = [
      crucibleApiResponse(file),
      crucibleApiResponse({ detail: "checksum_mismatch" }, { status: 422 }),
    ]
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        return responses.shift()
      })
    )
    const input = {
      crc32cBase64: "AAAAAA==",
      datasetMfid,
      sha256Hex: "a".repeat(64),
      uploadId: "upload-1",
    }

    await expect(completeWorkspaceUpload(input)).resolves.toMatchObject({
      mfid: "file-1",
    })
    await expect(requests[0].json()).resolves.toEqual({
      crc32c: "AAAAAA==",
      sha256_hash: "a".repeat(64),
      upload_id: "upload-1",
    })
    await expect(completeWorkspaceUpload(input)).rejects.toMatchObject({
      status: 422,
    })
  })

  it("accepts API abort cleanup responses", async () => {
    stubApiMode()
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(null, {
            headers: { "Crucible-Privilege-Mode": "normal" },
            status: 204,
          })
      )
    )

    await expect(
      abortWorkspaceUpload({ datasetMfid, uploadId: "upload-1" })
    ).resolves.toBeUndefined()
  })
})
