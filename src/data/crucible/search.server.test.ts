import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import { fixturePublicOnlyMfids } from "./fixtures/demo-workspace"
import { searchWorkspace, searchWorkspaceMetadata } from "./search.server"

const allKinds = [
  "person",
  "project",
  "instrument",
  "sample",
  "dataset",
] as const

describe("workspace search source", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("groups ranked fixture matches and respects selected kinds", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")

    const result = await searchWorkspace({
      kinds: ["sample", "dataset"],
      limit: 8,
      query: "NiFe",
    })

    expect(result.groups.map((group) => group.kind)).toEqual([
      "sample",
      "dataset",
    ])
    expect(result.groups[0].items).toHaveLength(2)
    expect(result.groups[1].items).toHaveLength(2)
    expect(result.groups[0].items[0]).toMatchObject({
      kind: "sample",
      name: "NiFe oxide catalyst A",
      projectId: "operando-catalyst-mapping",
    })
  })

  it("restricts fixture data search to the selected project", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")

    const result = await searchWorkspace({
      kinds: ["sample"],
      limit: 8,
      projectMfid: "fixture-project-1",
      query: "Catalyst sample 2",
      scenario: "dense",
    })

    expect(result.groups[0].items.map((item) => item.unique_id)).toEqual([
      "fixture-sample-2",
      "fixture-sample-25",
    ])
  })

  it("reports one fixture search failure without hiding other groups", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")

    const result = await searchWorkspace({
      kinds: allKinds,
      limit: 8,
      query: "operando",
      scenario: "partial",
    })

    expect(result.groups.find((group) => group.kind === "dataset")).toEqual({
      error: true,
      items: [],
      kind: "dataset",
      total: null,
    })
    expect(
      result.groups.find((group) => group.kind === "project")?.items
    ).not.toHaveLength(0)
  })

  it("resolves a complete MFID directly", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")

    const result = await searchWorkspace({
      kinds: allKinds,
      limit: 8,
      query: "01J6Y8N4Q2R7M9K3T5V0W1X2Z7",
    })

    expect(result.groups.flatMap((group) => group.items)).toEqual([
      {
        context: "X-ray absorption spectroscopy",
        kind: "dataset",
        name: "NiFe K-edge operando series",
        projectId: "operando-catalyst-mapping",
        unique_id: "01J6Y8N4Q2R7M9K3T5V0W1X2Z7",
      },
    ])
  })

  it("sends the member affiliation to sample, dataset and metadata search", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const affiliations = new Map<string, string[]>()
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        const url = new URL(request.url)
        affiliations.set(url.pathname, url.searchParams.getAll("affiliation"))
        if (url.pathname === "/users/search") return crucibleApiResponse([])
        return crucibleApiResponse({ items: [], limit: 8, total: 0 })
      })
    )

    await searchWorkspace({
      affiliation: "member",
      kinds: ["sample", "dataset", "project"],
      limit: 8,
      query: "operando",
    })
    await searchWorkspaceMetadata({
      affiliation: "member",
      limit: 8,
      query: "operando",
    })

    expect(affiliations.get("/samples/search")).toEqual(["member"])
    expect(affiliations.get("/datasets/search")).toEqual(["member"])
    expect(affiliations.get("/projects/search")).toEqual([])
    expect(affiliations.get("/resources/metadata/search")).toEqual(["member"])
  })

  it("hides fixture search results visible only because they are public", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")
    const ids = (result: Awaited<ReturnType<typeof searchWorkspace>>) =>
      result.groups.flatMap((group) =>
        group.items.map((item) => item.unique_id)
      )

    const all = await searchWorkspace({
      kinds: ["sample", "dataset"],
      limit: 50,
      query: "",
    })
    const member = await searchWorkspace({
      affiliation: "member",
      kinds: ["sample", "dataset"],
      limit: 50,
      query: "",
    })

    expect(ids(all).some((id) => fixturePublicOnlyMfids.has(id))).toBe(true)
    expect(ids(member).some((id) => fixturePublicOnlyMfids.has(id))).toBe(false)
  })

  it("still finds a public-only record by its MFID", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")

    const result = await searchWorkspace({
      affiliation: "member",
      kinds: ["sample", "dataset"],
      limit: 8,
      query: "01J6Y8N4Q2R7M9K3T5V0W1X2ZH",
    })

    expect(
      result.groups.flatMap((group) =>
        group.items.map((item) => item.unique_id)
      )
    ).toEqual(["01J6Y8N4Q2R7M9K3T5V0W1X2ZH"])
  })

  it("bounds API aggregation and preserves successful groups", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const requestedPaths: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        const url = new URL(request.url)
        requestedPaths.push(url.pathname)
        if (url.pathname === "/instruments/search") {
          return new Response(null, { status: 503 })
        }
        if (url.pathname === "/users/search") return crucibleApiResponse([])
        const items =
          url.pathname === "/projects/search"
            ? [
                {
                  organization: "Example Laboratory",
                  project_id: "operando",
                  title: "Operando Project",
                  unique_id: "project-mfid",
                },
              ]
            : []
        return crucibleApiResponse({ items, limit: 8, total: items.length })
      })
    )

    const result = await searchWorkspace({
      kinds: allKinds,
      limit: 8,
      query: "operando",
    })

    expect(requestedPaths.sort()).toEqual([
      "/datasets/search",
      "/instruments/search",
      "/projects/search",
      "/samples/search",
      "/users/search",
    ])
    expect(
      result.groups.find((group) => group.kind === "project")?.items
    ).toHaveLength(1)
    expect(
      result.groups.find((group) => group.kind === "instrument")?.error
    ).toBe(true)
  })

  it("falls back to the username or MFID when a person has no display name", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        crucibleApiResponse([
          {
            first_name: "Titanx",
            is_service_account: true,
            last_name: "Admin",
            unique_id: "user-mfid-1",
            username: "titanx_admin",
          },
          {
            first_name: "",
            is_service_account: true,
            last_name: "",
            unique_id: "user-mfid-2",
            username: "sa-hip",
          },
          {
            first_name: "",
            is_service_account: true,
            last_name: "",
            unique_id: "user-mfid-3",
            username: null,
          },
        ])
      )
    )

    const result = await searchWorkspace({
      kinds: ["person"],
      limit: 8,
      query: "service",
    })

    expect(result.groups[0].items.map((item) => item.name)).toEqual([
      "Titanx Admin",
      "sa-hip",
      "user-mfid-3",
    ])
  })

  it("browses initial collections when query is empty in fixture mode", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")

    const result = await searchWorkspace({
      kinds: ["instrument", "project"],
      limit: 8,
      query: "",
    })

    expect(result.groups.map((g) => g.kind)).toEqual(["instrument", "project"])
    expect(result.groups[0].items.length).toBeGreaterThan(0)
    expect(result.groups[1].items.length).toBeGreaterThan(0)
  })

  it("calls collection list endpoints rather than search endpoints when query is empty in API mode", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const requestedPaths: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        const url = new URL(request.url)
        requestedPaths.push(url.pathname)
        if (url.pathname === "/projects") {
          const items = [
            {
              organization: "Lab",
              project_id: "demo-project",
              title: "Demo Project",
              unique_id: "proj-1",
            },
          ]
          return crucibleApiResponse({ items, total: items.length })
        }
        if (url.pathname === "/users") {
          const items = [
            {
              first_name: "Alice",
              last_name: "Smith",
              unique_id: "user-1",
              username: "asmith",
            },
          ]
          return crucibleApiResponse({ items, total: items.length })
        }
        return crucibleApiResponse({ items: [], total: 0 })
      })
    )

    const result = await searchWorkspace({
      kinds: ["project", "person"],
      limit: 8,
      query: "",
    })

    expect(requestedPaths.sort()).toEqual(["/projects", "/users"])
    expect(result.groups[0].items[0]).toMatchObject({
      kind: "project",
      name: "Demo Project",
      unique_id: "proj-1",
    })
    expect(result.groups[1].items[0]).toMatchObject({
      kind: "person",
      name: "Alice Smith",
      unique_id: "user-1",
    })
  })
})
