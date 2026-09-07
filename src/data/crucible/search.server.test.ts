import { afterEach, describe, expect, it, vi } from "vitest"

import { searchWorkspace } from "./search.server"

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
    vi.stubEnv("HUB_DATA_SOURCE", "")

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
    })
  })

  it("restricts fixture data search to the selected project", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

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
    vi.stubEnv("HUB_DATA_SOURCE", "")

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
    vi.stubEnv("HUB_DATA_SOURCE", "")

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
        unique_id: "01J6Y8N4Q2R7M9K3T5V0W1X2Z7",
      },
    ])
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
        if (url.pathname === "/users/search") return Response.json([])
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
        return Response.json({ items, limit: 8, total: items.length })
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
})
