import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import {
  reassignWorkspaceResourceProject,
  transferWorkspaceResourceOwnership,
} from "./resource-assignments.server"

describe("resource ownership and assignment sources", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("previews and confirms ownership through the same resource operation", async () => {
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
          new_owner: {
            first_name: "Morgan",
            last_name: "Lee",
            unique_id: "person-mfid",
          },
          resource_mfid: "resource-mfid",
        })
      })
    )

    await transferWorkspaceResourceOwnership(
      "resource-mfid",
      "person-mfid",
      false
    )
    await transferWorkspaceResourceOwnership(
      "resource-mfid",
      "person-mfid",
      true
    )

    expect(
      requests.map((request) =>
        Object.fromEntries(new URL(request.url).searchParams)
      )
    ).toEqual([{ confirm: "false" }, { confirm: "true" }])
    await expect(requests[0].json()).resolves.toEqual({
      new_owner_ref: "person-mfid",
    })
  })

  it("reassigns a project directly by project MFID", async () => {
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
          new_project_id: "project-slug",
          new_project_mfid: "project-mfid",
          resource_id: "resource-mfid",
          resource_mfid: "resource-mfid",
        })
      })
    )

    await reassignWorkspaceResourceProject(
      "resource-mfid",
      "project-mfid",
      false
    )

    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      "/resources/resource-mfid/project",
    ])
    expect(Object.fromEntries(new URL(requests[0].url).searchParams)).toEqual({
      confirm: "false",
    })
    await expect(requests[0].json()).resolves.toEqual({
      project_mfid: "project-mfid",
    })
  })
})
