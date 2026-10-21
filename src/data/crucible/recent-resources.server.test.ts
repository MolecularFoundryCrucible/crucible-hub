import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import {
  clearRecentResources,
  readRecentResources,
  recordRecentResource,
} from "./recent-resources.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"

function stubApiMode() {
  vi.stubEnv("NODE_ENV", "development")
  vi.stubEnv("HUB_DATA_SOURCE", "api")
  vi.stubEnv("HUB_ACCOUNT_PREFERENCES_ENABLED", "true")
  vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
  vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
}

describe("recent resources transport", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("keeps fixture history newest first without duplicates", async () => {
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")
    const source = readWorkspaceFixture()
    if (source.status !== "ready") throw new Error("Fixture unavailable.")
    const [first, second] = source.workspace.samples
    await clearRecentResources()

    await recordRecentResource(first.unique_id)
    await recordRecentResource(second.unique_id)
    await recordRecentResource(first.unique_id)

    const history = await readRecentResources(10)
    expect(history.map((item) => item.uniqueId)).toEqual([
      first.unique_id,
      second.unique_id,
    ])
    expect(history[0]).toMatchObject({ kind: "sample" })
    await expect(recordRecentResource("missing")).rejects.toMatchObject({
      status: 404,
    })
    await clearRecentResources()
    await expect(readRecentResources(10)).resolves.toEqual([])
  })

  it("maps API history and records views by MFID in the body", async () => {
    stubApiMode()
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string, init?: RequestInit) => {
        const request = new Request(input, init)
        requests.push(request)
        if (request.method === "POST") {
          return new Response(null, {
            headers: { "Crucible-Privilege-Mode": "normal" },
            status: 204,
          })
        }
        return crucibleApiResponse([
          {
            identifier: null,
            name: null,
            project_id: "beamline",
            resource_mfid: "dataset-1",
            resource_type: "dataset",
            viewed_at: "2026-10-14T12:00:00Z",
          },
          {
            identifier: "hard-xray-microprobe",
            name: "Hard X-ray Microprobe",
            project_id: null,
            resource_mfid: "instrument-1",
            resource_type: "instrument",
            viewed_at: "2026-10-14T11:00:00Z",
          },
        ])
      })
    )

    await expect(readRecentResources(10)).resolves.toEqual([
      {
        identifier: null,
        kind: "dataset",
        name: "dataset-1",
        projectId: "beamline",
        uniqueId: "dataset-1",
        viewedAt: "2026-10-14T12:00:00Z",
      },
      {
        identifier: "hard-xray-microprobe",
        kind: "instrument",
        name: "Hard X-ray Microprobe",
        projectId: null,
        uniqueId: "instrument-1",
        viewedAt: "2026-10-14T11:00:00Z",
      },
    ])
    expect(new URL(requests[0].url).searchParams.get("limit")).toBe("10")

    await recordRecentResource("dataset-1")
    expect(new URL(requests[1].url).pathname).toBe("/account/recent-resources")
    await expect(requests[1].json()).resolves.toEqual({
      resource_mfid: "dataset-1",
    })
  })
})
