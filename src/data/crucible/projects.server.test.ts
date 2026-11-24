import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import {
  addWorkspaceProjectMember,
  checkWorkspaceProjectIdExactMatch,
  patchWorkspaceProject,
  readWorkspaceProject,
  readWorkspaceProjects,
  readWorkspaceUserProjects,
  removeWorkspaceProjectMember,
  updateWorkspaceProjectMemberRole,
} from "./projects.server"

describe("workspace project source", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("preserves the public-safe project owner without unsupported query parameters", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url)
      expect(url.pathname).toBe("/projects/project-mfid")
      expect(url.searchParams).toEqual(
        new URLSearchParams({
          include_members: "true",
          include_metadata: "true",
        })
      )
      return crucibleApiResponse({
        organization: "Example Lab",
        owner: {
          first_name: "Ada",
          last_name: "Lovelace",
          unique_id: "lead-mfid",
          username: "ada",
        },
        project_id: "project",
        scientific_metadata: {
          context: { technique: "XAS", values: [1, true, null] },
        },
        title: "Project",
        unique_id: "project-mfid",
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(readWorkspaceProject("project-mfid")).resolves.toMatchObject({
      owner: { first_name: "Ada", unique_id: "lead-mfid" },
      scientific_metadata: {
        context: { technique: "XAS", values: [1, true, null] },
      },
    })
  })

  it("lists a user's projects with that user's role from the user route", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url)
      expect(url.pathname).toBe("/users/user-mfid/projects")
      expect(url.searchParams.get("sort")).toBe("created")
      expect(url.searchParams.get("direction")).toBe("desc")
      expect(url.searchParams.get("limit")).toBe("100")
      expect(url.searchParams.has("member_ref")).toBe(false)
      return crucibleApiResponse(
        {
          items: [
            {
              owner: {
                first_name: "Ada",
                last_name: "Lovelace",
                unique_id: "lead-mfid",
                username: "ada",
              },
              organization: "Example Lab",
              project_id: "project",
              role: "viewer",
              title: "Project",
              unique_id: "project-mfid",
            },
          ],
          limit: 100,
          next_cursor: null,
          offset: 0,
          total: 1,
        },
        {},
        "elevated"
      )
    })
    vi.stubGlobal("fetch", fetchMock)

    const page = await readWorkspaceUserProjects({
      direction: "desc",
      limit: 100,
      privilegeMode: "elevated",
      sort: "created",
      userRef: "user-mfid",
    })
    expect(page.items[0]).toMatchObject({
      role: "viewer",
      unique_id: "project-mfid",
    })
    expect(page.total).toBe(1)
  })

  it("patches projects through the API and normalizes its response", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const fetchMock = vi.fn(async (request: Request) => {
      expect(request.method).toBe("PATCH")
      expect(new URL(request.url).pathname).toBe("/projects/project-mfid")
      expect(await request.json()).toEqual({
        organization: "Updated Example Lab",
        project_id: "updated-catalyst-mapping",
        title: "Updated Catalyst Mapping",
      })
      return crucibleApiResponse({
        capabilities: {
          can_change_status: true,
          can_edit: true,
          can_manage_access: false,
          can_transfer: false,
          max_grant_role: "admin",
        },
        organization: "Updated Example Lab",
        project_id: "updated-catalyst-mapping",
        status: "active",
        title: "Updated Catalyst Mapping",
        unique_id: "project-mfid",
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      patchWorkspaceProject("project-mfid", {
        organization: "Updated Example Lab",
        project_id: "updated-catalyst-mapping",
        title: "Updated Catalyst Mapping",
      })
    ).resolves.toMatchObject({
      organization: "Updated Example Lab",
      project_id: "updated-catalyst-mapping",
      title: "Updated Catalyst Mapping",
      unique_id: "project-mfid",
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("preserves withheld project membership as unavailable", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        if (request.url.includes("/account/profile")) {
          return crucibleApiResponse({
            first_name: "Ada",
            last_name: "Lovelace",
            unique_id: "account-mfid",
            username: "ada",
          })
        }
        return crucibleApiResponse({
          items: [
            {
              capabilities: {
                can_change_status: true,
                can_edit: true,
                can_manage_access: true,
                can_transfer: false,
                max_grant_role: "admin",
              },
              members: null,
              organization: "Example Lab",
              project_id: "withheld-members",
              status: "active",
              title: "Withheld Members",
              unique_id: "project-withheld",
            },
            {
              organization: "Example Lab",
              project_id: "omitted-members",
              status: "active",
              title: "Omitted Members",
              unique_id: "project-omitted",
            },
            {
              members: [],
              organization: "Example Lab",
              project_id: "empty-members",
              status: "active",
              title: "Empty Members",
              unique_id: "project-empty",
            },
          ],
          limit: 20,
          offset: 0,
          total: 3,
        })
      })
    )

    const page = await readWorkspaceProjects({ limit: 20 })

    expect(page.items[0]).toMatchObject({ members: null })
    expect(page.items[0]?.capabilities).toMatchObject({ can_edit: true })
    expect(page.items[1]).toMatchObject({ capabilities: null })
    expect(page.items[1]).not.toHaveProperty("members")
    expect(page.items[2]).toMatchObject({ members: [] })
  })

  it("adds, updates and removes project members through the API", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const members = [
      {
        first_name: "Ada",
        is_service_account: false,
        last_name: "Lovelace",
        role: "editor",
        unique_id: "user-1",
        username: "ada",
      },
    ]
    const requests: { method: string; pathname: string; search: string }[] = []
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url)
      expect(request.signal.aborted).toBe(false)
      requests.push({
        method: request.method,
        pathname: url.pathname,
        search: url.search,
      })
      return crucibleApiResponse(members)
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      addWorkspaceProjectMember(
        "project-mfid",
        "user-2",
        "contributor",
        undefined,
        new AbortController().signal
      )
    ).resolves.toEqual(members)
    await expect(
      updateWorkspaceProjectMemberRole("project-mfid", "user-1", "admin")
    ).resolves.toEqual(members)
    await expect(
      removeWorkspaceProjectMember("project-mfid", "user-1")
    ).resolves.toEqual(members)
    expect(requests).toEqual([
      {
        method: "POST",
        pathname: "/projects/project-mfid/users/user-2",
        search: "?role=contributor",
      },
      {
        method: "PATCH",
        pathname: "/projects/project-mfid/users/user-1",
        search: "?role=admin",
      },
      {
        method: "DELETE",
        pathname: "/projects/project-mfid/users/user-1",
        search: "",
      },
    ])
  })

  it("checks project_id availability through the API", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")

    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url)
      expect(url.pathname).toBe("/projects")
      const projectId = url.searchParams.get("project_id")
      if (projectId === "taken-project") {
        return crucibleApiResponse({
          items: [{ project_id: "taken-project", unique_id: "proj-1" }],
        })
      }
      return crucibleApiResponse({ items: [] })
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      checkWorkspaceProjectIdExactMatch("taken-project")
    ).resolves.toBe(true)
    await expect(
      checkWorkspaceProjectIdExactMatch("available-project")
    ).resolves.toBe(false)
  })
})
