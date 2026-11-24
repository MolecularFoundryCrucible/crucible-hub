import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import {
  deleteWorkspaceResource,
  requestWorkspaceResourceDeletion,
} from "./resource-deletion.server"

describe("resource deletion sources", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("posts a deletion request, maps an active request conflict, and rejects mismatched response identity", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        return crucibleApiResponse({
          id: 12,
          project_id: "project-1",
          reason: "cleanup",
          request_time: "2026-09-06T01:00:00Z",
          requester_id: "user-1",
          resource_mfid: "sample-1",
          resource_name: "Sample",
          resource_type: "sample",
          review_time: null,
          reviewer_id: null,
          reviewer_notes: null,
          status: "pending",
        })
      })
    )

    await expect(
      requestWorkspaceResourceDeletion("sample-1", "cleanup")
    ).resolves.toMatchObject({ id: 12, resource_mfid: "sample-1" })
    expect(requests[0]!.method).toBe("POST")
    expect(new URL(requests[0]!.url).pathname).toBe(
      "/resources/sample-1/delete"
    )
    expect(new URL(requests[0]!.url).search).toBe("?reason=cleanup")
    expect(requests[0]!.signal).toBeDefined()

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => crucibleApiResponse({}, { status: 409 }))
    )
    await expect(
      safeCrucibleCall("test-correlation", () =>
        requestWorkspaceResourceDeletion("sample-1")
      )
    ).resolves.toMatchObject({
      status: "error",
      error: { kind: "conflict", retryable: false },
    })

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        crucibleApiResponse({
          id: 12,
          requester_id: "user-1",
          resource_mfid: "other-resource",
          status: "pending",
        })
      )
    )
    await expect(requestWorkspaceResourceDeletion("sample-1")).rejects.toThrow(
      "another resource"
    )
  })

  it("requests forced deletion without confirm first and sends confirm to execute", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        return crucibleApiResponse({
          blocking: {},
          deleted: requests.length === 2,
          memberships_removed: 1,
          resource_mfid: "resource-mfid",
          resource_type: "project",
        })
      })
    )

    await deleteWorkspaceResource("resource-mfid", false)
    await deleteWorkspaceResource("resource-mfid", true)

    expect(
      requests.map((request) => request.method + new URL(request.url).pathname)
    ).toEqual([
      "DELETE/resources/resource-mfid",
      "DELETE/resources/resource-mfid",
    ])
    expect(
      requests.map((request) =>
        Object.fromEntries(new URL(request.url).searchParams)
      )
    ).toEqual([{ force: "true" }, { force: "true", confirm: "true" }])
  })

  it("rejects a deletion response that is invalid or does not match the request", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        crucibleApiResponse({
          deleted: false,
          resource_mfid: "other-mfid",
          resource_type: "project",
        })
      )
    )

    await expect(
      deleteWorkspaceResource("resource-mfid", false)
    ).rejects.toThrow("The deletion response identifies another resource.")

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => crucibleApiResponse({ resource_mfid: "resource-mfid" }))
    )

    await expect(
      deleteWorkspaceResource("resource-mfid", false)
    ).rejects.toThrow("The deletion response is invalid.")
  })
})
