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

  it("paginates fixture projects", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")

    const first = await readWorkspaceProjects({ limit: 1 })
    const second = await readWorkspaceProjects({
      cursor: "fixture:1",
      limit: 1,
    })

    expect(first.items).toHaveLength(1)
    expect(second.items).toHaveLength(1)
    expect(first.items[0]?.unique_id).not.toBe(second.items[0]?.unique_id)
    expect(first.total).toBe(2)
  })

  it("resolves fixture project detail by canonical MFID", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")

    const project = await readWorkspaceProject("01J6Y8N4Q2R7M9K3T5V0W1X2Z3")

    expect(project?.project_id).toBe("operando-catalyst-mapping")
    expect(project?.capabilities).toMatchObject({
      can_edit: true,
      can_manage_access: true,
    })
    expect(project).toMatchObject({
      lead: {
        first_name: "Avery",
        last_name: "Chen",
        unique_id: "0000-0000-0000-000X",
      },
      scientific_metadata: {
        beamtime_cycle: "2026-2",
        research_area: "electrocatalysis",
      },
    })
    await expect(readWorkspaceProject("missing-project")).resolves.toBeNull()
  })

  it("preserves the public-safe project lead without unsupported query parameters", async () => {
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
        lead: {
          first_name: "Ada",
          last_name: "Lovelace",
          unique_id: "lead-mfid",
          username: "ada",
        },
        organization: "Example Lab",
        project_id: "project",
        project_lead_orcid: "lead-mfid",
        scientific_metadata: {
          context: { technique: "XAS", values: [1, true, null] },
        },
        title: "Project",
        unique_id: "project-mfid",
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(readWorkspaceProject("project-mfid")).resolves.toMatchObject({
      lead: { first_name: "Ada", unique_id: "lead-mfid" },
      project_lead_orcid: "lead-mfid",
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
              lead: {
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

  it("normalizes fixture project updates without exposing lifecycle fields", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")

    const project = await patchWorkspaceProject("01J6Y8N4Q2R7M9K3T5V0W1X2Z3", {
      organization: "Updated Example Lab",
      project_id: "updated-catalyst-mapping",
      title: "Updated Catalyst Mapping",
    })

    expect(project).toMatchObject({
      organization: "Updated Example Lab",
      project_id: "updated-catalyst-mapping",
      status: "active",
      title: "Updated Catalyst Mapping",
      unique_id: "01J6Y8N4Q2R7M9K3T5V0W1X2Z3",
    })
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

  it("does not bypass the production fixture guard", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")
    vi.stubEnv("HUB_ENABLE_FIXTURES", "")

    await expect(readWorkspaceProjects({ limit: 20 })).rejects.toThrow(
      "The Crucible API login exchange is not connected yet."
    )
  })

  it("adds a project member through the API query", async () => {
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
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url)
      expect(request.method).toBe("POST")
      expect(url.pathname).toBe("/projects/project-mfid/users/user-2")
      expect(url.search).toBe("?role=contributor")
      expect(request.signal.aborted).toBe(false)
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
  })

  it("updates a project member role through the API query", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const members = [
      {
        first_name: "Ada",
        is_service_account: false,
        last_name: "Lovelace",
        role: "admin",
        unique_id: "user-1",
        username: "ada",
      },
    ]
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url)
      expect(request.method).toBe("PATCH")
      expect(url.pathname).toBe("/projects/project-mfid/users/user-1")
      expect(url.search).toBe("?role=admin")
      return crucibleApiResponse(members)
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      updateWorkspaceProjectMemberRole("project-mfid", "user-1", "admin")
    ).resolves.toEqual(members)
  })

  it("removes a project member through the API without a query", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const members = [
      {
        first_name: "Ada",
        is_service_account: false,
        last_name: "Lovelace",
        role: "owner",
        unique_id: "owner-1",
        username: "ada",
      },
    ]
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url)
      expect(request.method).toBe("DELETE")
      expect(url.pathname).toBe("/projects/project-mfid/users/user-1")
      expect(url.search).toBe("")
      return crucibleApiResponse(members)
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      removeWorkspaceProjectMember("project-mfid", "user-1")
    ).resolves.toEqual(members)
  })

  it("returns deterministic fixture member changes without mutating fixtures", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")
    const projectMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z3"

    const added = await addWorkspaceProjectMember(
      projectMfid,
      "fixture-new-user",
      "viewer"
    )
    const updated = await updateWorkspaceProjectMemberRole(
      projectMfid,
      "0000-0000-0000-0018",
      "admin"
    )
    const removed = await removeWorkspaceProjectMember(
      projectMfid,
      "01J6Y8N4Q2R7M9K3T5V0W1X2ZA"
    )

    expect(added).toHaveLength(4)
    expect(added.at(-1)).toMatchObject({
      role: "viewer",
      unique_id: "fixture-new-user",
    })
    expect(
      updated.find((member) => member.unique_id === "0000-0000-0000-0018")
    ).toMatchObject({ role: "admin" })
    expect(
      removed.some(
        (member) => member.unique_id === "01J6Y8N4Q2R7M9K3T5V0W1X2ZA"
      )
    ).toBe(false)

    const original = await readWorkspaceProject(projectMfid)
    expect(original && "members" in original).toBe(true)
    if (original && "members" in original) {
      expect(original.members).toHaveLength(3)
      expect(
        original.members?.find(
          (member) => member.unique_id === "0000-0000-0000-000X"
        )
      ).toMatchObject({ role: "owner" })
    }
  })

  it("matches API duplicate-member behavior in fixture mode", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")
    const projectMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z3"

    await expect(
      addWorkspaceProjectMember(projectMfid, "0000-0000-0000-0018", "editor")
    ).resolves.toHaveLength(3)
    await expect(
      addWorkspaceProjectMember(projectMfid, "0000-0000-0000-0018", "viewer")
    ).rejects.toMatchObject({ status: 409 })
  })

  it("rejects duplicate project_id updates with 409 conflict in fixture mode", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")

    await expect(
      patchWorkspaceProject("01J6Y8N4Q2R7M9K3T5V0W1X2Z3", {
        project_id: "porous-framework-screening",
      })
    ).rejects.toMatchObject({ status: 409 })
  })

  it("checks project_id availability in fixture and API mode", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")

    await expect(
      checkWorkspaceProjectIdExactMatch("operando-catalyst-mapping")
    ).resolves.toBe(true)
    await expect(
      checkWorkspaceProjectIdExactMatch("OPERANDO-CATALYST-MAPPING")
    ).resolves.toBe(true)
    await expect(
      checkWorkspaceProjectIdExactMatch("non-existent-project")
    ).resolves.toBe(false)

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
