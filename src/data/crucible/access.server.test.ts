import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import { CrucibleResponseError } from "@/server/crucible/request-error.server"

import {
  publishWorkspaceResourceAccess,
  readWorkspaceResourceAccess,
  resetWorkspaceFixtureAccessState,
  revokeWorkspaceResourceAccessGrant,
  setWorkspaceResourceAccessGrant,
  unpublishWorkspaceResourceAccess,
} from "./access.server"

const sampleMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z5"
const projectMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z3"
const accountMfid = "0000-0000-0000-000X"

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
    resetWorkspaceFixtureAccessState()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("returns deterministic fixture grants and preserves owner grants", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")

    await expect(readWorkspaceResourceAccess(sampleMfid)).resolves.toEqual([
      expect.objectContaining({
        permission: "owner",
        principal_id: accountMfid,
        principal_type: "user",
      }),
      expect.objectContaining({
        permission: "viewer",
        principal_id: projectMfid,
        principal_type: "project",
      }),
    ])
  })

  it("returns full deterministic fixture grant lists for set and revoke", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")

    const added = await setWorkspaceResourceAccessGrant(
      sampleMfid,
      "users",
      "0000-0000-0000-0026",
      "editor"
    )
    expect(added).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          permission: "owner",
          principal_id: accountMfid,
        }),
        expect.objectContaining({
          permission: "editor",
          principal_id: "0000-0000-0000-0026",
          principal_type: "user",
        }),
      ])
    )
    const updated = await setWorkspaceResourceAccessGrant(
      sampleMfid,
      "users",
      "0000-0000-0000-0026",
      "viewer"
    )
    expect(
      updated.filter((grant) => grant.principal_id === "0000-0000-0000-0026")
    ).toEqual([expect.objectContaining({ permission: "viewer" })])
    await expect(readWorkspaceResourceAccess(sampleMfid)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          permission: "viewer",
          principal_id: "0000-0000-0000-0026",
        }),
      ])
    )
    await expect(
      revokeWorkspaceResourceAccessGrant(
        sampleMfid,
        "users",
        "0000-0000-0000-0026"
      )
    ).resolves.not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ principal_id: "0000-0000-0000-0026" }),
      ])
    )
    await expect(
      setWorkspaceResourceAccessGrant(
        sampleMfid,
        "projects",
        projectMfid,
        "admin"
      )
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          permission: "admin",
          principal_id: projectMfid,
          principal_type: "project",
        }),
      ])
    )
    await expect(
      revokeWorkspaceResourceAccessGrant(sampleMfid, "users", accountMfid)
    ).rejects.toMatchObject({ status: 403 })
  })

  it("returns exact fixture resource details with authoritative public grants", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")

    await expect(publishWorkspaceResourceAccess(sampleMfid)).resolves.toEqual(
      expect.objectContaining({
        grants: expect.arrayContaining([
          expect.objectContaining({
            permission: "viewer",
            principal_id: "public",
            principal_type: "public",
          }),
        ]),
        resource: expect.objectContaining({
          kind: "sample",
          public: true,
          unique_id: sampleMfid,
        }),
      })
    )
    await expect(unpublishWorkspaceResourceAccess(sampleMfid)).resolves.toEqual(
      expect.objectContaining({
        grants: expect.not.arrayContaining([
          expect.objectContaining({ principal_type: "public" }),
        ]),
        resource: expect.objectContaining({ public: false }),
      })
    )
    await expect(readWorkspaceResourceAccess(sampleMfid)).resolves.toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ principal_type: "public" }),
      ])
    )
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

  it("propagates cancellation to access reads", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const controller = new AbortController()
    let requestSignal: AbortSignal | undefined
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requestSignal = request.signal
        return crucibleApiResponse([])
      })
    )

    await readWorkspaceResourceAccess(
      "resource-1",
      undefined,
      controller.signal
    )
    expect(requestSignal).toBeDefined()
    controller.abort()
    expect(requestSignal?.aborted).toBe(true)
  })

  it("maps missing fixture resources to not found", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")

    await expect(
      readWorkspaceResourceAccess("missing-resource")
    ).rejects.toBeInstanceOf(CrucibleResponseError)
  })
})
