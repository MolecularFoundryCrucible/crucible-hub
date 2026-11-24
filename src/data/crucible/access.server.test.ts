import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import {
  publishWorkspaceResourceAccess,
  revokeWorkspaceResourceAccessGrant,
  setWorkspaceResourceAccessGrant,
  unpublishWorkspaceResourceAccess,
} from "./access.server"

function sampleDetail(uniqueId: string) {
  return {
    capabilities: null,
    creation_time: null,
    links: [],
    modification_time: null,
    owner: null,
    project: null,
    public: false,
    resource_type: "sample",
    sample_name: "Sample",
    sample_type: null,
    scientific_metadata: null,
    unique_id: uniqueId,
  }
}

describe("workspace resource access source", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("uses documented API methods, paths, bodies, and grant rereads", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        if (request.method === "GET") {
          return crucibleApiResponse([
            {
              permission: "viewer",
              principal_id: "principal-1",
              principal_type: "service_account",
            },
            {
              permission: "admin",
              principal_id: "principal-2",
              principal_type: "unknown",
            },
          ])
        }
        return new Response(null, {
          headers: { "Crucible-Privilege-Mode": "normal" },
          status: 200,
        })
      })
    )

    await expect(
      setWorkspaceResourceAccessGrant(
        "resource-1",
        "users",
        "user-1",
        "contributor"
      )
    ).resolves.toEqual([
      expect.objectContaining({ principal_type: "service_account" }),
      expect.objectContaining({ principal_type: "unknown" }),
    ])
    expect(requests[0].method).toBe("PUT")
    expect(new URL(requests[0].url).pathname).toBe(
      "/resources/resource-1/access/users/user-1"
    )
    await expect(requests[0].json()).resolves.toEqual({
      permission: "contributor",
    })
    expect(requests[1].method).toBe("GET")
    expect(new URL(requests[1].url).pathname).toBe(
      "/resources/resource-1/access"
    )

    requests.length = 0
    await revokeWorkspaceResourceAccessGrant(
      "resource-1",
      "projects",
      "project-1"
    )
    expect(requests[0].method).toBe("DELETE")
    expect(new URL(requests[0].url).pathname).toBe(
      "/resources/resource-1/access/projects/project-1"
    )
    expect(requests[1].method).toBe("GET")
  })

  it("publishes and unpublishes through API then rereads grants and detail", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        const path = new URL(request.url).pathname
        if (path.endsWith("/access")) return crucibleApiResponse([])
        if (request.method === "GET") {
          return crucibleApiResponse(sampleDetail("resource-1"))
        }
        return new Response(null, {
          headers: { "Crucible-Privilege-Mode": "normal" },
          status: 200,
        })
      })
    )

    await expect(
      publishWorkspaceResourceAccess("resource-1")
    ).resolves.toMatchObject({
      grants: [],
      resource: { kind: "sample", unique_id: "resource-1" },
    })
    expect(requests[0].method).toBe("PUT")
    expect(new URL(requests[0].url).pathname).toBe(
      "/resources/resource-1/access/public"
    )
    expect(
      requests.slice(1).map((request) => new URL(request.url).pathname)
    ).toEqual(
      expect.arrayContaining([
        "/resources/resource-1/access",
        "/resources/resource-1",
      ])
    )

    requests.length = 0
    await unpublishWorkspaceResourceAccess("resource-1")
    expect(requests[0].method).toBe("DELETE")
    expect(new URL(requests[0].url).pathname).toBe(
      "/resources/resource-1/access/public"
    )
  })
})
