import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"
import { CrucibleResponseError } from "@/server/crucible/request-error.server"

import {
  createWorkspaceFileDownload,
  readWorkspaceDatasetIngestionRequests,
  readWorkspaceIngestionClasses,
} from "./dataset-files.server"

describe("dataset file sources", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("asks for a dataset's ingestion requests by its MFID", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        return crucibleApiResponse({ items: [], total: 0 })
      })
    )

    await expect(
      readWorkspaceDatasetIngestionRequests("dataset-1")
    ).resolves.toEqual({ items: [], total: 0 })
    const query = new URL(requests[0].url).searchParams
    expect(query.get("dataset_mfid")).toBe("dataset-1")
    expect(query.has("dataset_id")).toBe(false)
  })

  it("requests one validated file capability, inline only when asked, and maps unavailable and missing files", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const requests: Request[] = []
    const fetch = vi.fn(async (request: Request) => {
      requests.push(request)
      return crucibleApiResponse({
        expires_in: 3600,
        url: "https://downloads.example.invalid/file",
      })
    })
    vi.stubGlobal("fetch", fetch)

    expect(fetch).not.toHaveBeenCalled()
    await expect(createWorkspaceFileDownload("file-mfid")).resolves.toEqual({
      status: "ready",
      url: "https://downloads.example.invalid/file",
      expiresInSeconds: 3600,
    })

    expect(requests).toHaveLength(1)
    expect(new URL(requests[0].url).pathname).toBe(
      "/files/file-mfid/download_link"
    )
    expect(requests[0].headers.get("Authorization")).toBe(
      "Bearer local-test-key"
    )

    requests.length = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        return crucibleApiResponse({
          expires_in: 3600,
          url: "https://downloads.example.invalid/file",
        })
      })
    )

    await createWorkspaceFileDownload("file-mfid")
    await createWorkspaceFileDownload(
      "file-mfid",
      undefined,
      undefined,
      "inline"
    )
    expect(new URL(requests[0].url).searchParams.has("disposition")).toBe(false)
    expect(new URL(requests[1].url).searchParams.get("disposition")).toBe(
      "inline"
    )

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              detail: "File storage location is not valid: outside dataset",
            }),
            { status: 409, headers: { "Content-Type": "application/json" } }
          )
      )
    )
    await expect(createWorkspaceFileDownload("file-mfid")).resolves.toEqual({
      status: "unavailable",
    })

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => crucibleApiResponse({ expires_in: null, url: null }))
    )

    await expect(createWorkspaceFileDownload("file-mfid")).resolves.toEqual({
      status: "unavailable",
    })

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => crucibleApiResponse({}, { status: 404 }))
    )

    const result = await safeCrucibleCall("test-correlation", () =>
      createWorkspaceFileDownload("missing-file")
    )

    expect(result).toMatchObject({
      status: "error",
      error: { kind: "not-found", retryable: false },
    })
    await expect(
      createWorkspaceFileDownload("missing-file")
    ).rejects.toBeInstanceOf(CrucibleResponseError)
  })

  it.each([
    [
      {
        detail: {
          code: "storage_location_invalid",
          reason: "outside dataset",
          message: "File storage location is not valid: outside dataset",
        },
      },
      "unavailable",
    ],
    [{ detail: { code: "something_else" } }, "conflict"],
  ])(
    "maps a download 409 body %# by its structured code",
    async (body, outcome) => {
      vi.stubEnv("NODE_ENV", "development")
      vi.stubEnv("HUB_DATA_SOURCE", "api")
      vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
      vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            new Response(JSON.stringify(body), {
              status: 409,
              headers: { "Content-Type": "application/json" },
            })
        )
      )
      const download = createWorkspaceFileDownload("file-mfid")
      if (outcome === "unavailable") {
        await expect(download).resolves.toEqual({ status: "unavailable" })
      } else {
        await expect(download).rejects.toMatchObject({
          status: 409,
          conflictCode: "something_else",
        })
      }
    }
  )

  it.each([
    { expires_in: 3600, url: null },
    { expires_in: 3600, url: "http://downloads.example.invalid/file" },
  ])("maps malformed API capability %# to unexpected", async (payload) => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => crucibleApiResponse(payload))
    )

    const result = await safeCrucibleCall("test-correlation", () =>
      createWorkspaceFileDownload("file-mfid")
    )

    expect(result).toMatchObject({
      status: "error",
      error: { kind: "unexpected", retryable: true },
    })
  })

  it("reads the public ingestor list without a privilege-mode echo", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const fetchMock = vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe("/ingestors")
      expect(request.headers.has("Crucible-Privilege-Mode")).toBe(false)
      return Response.json([" AFMIngestor ", "BioGlowIngestor", "AFMIngestor"])
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(readWorkspaceIngestionClasses()).resolves.toEqual([
      "AFMIngestor",
      "BioGlowIngestor",
    ])
  })
})
