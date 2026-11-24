import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import {
  readRecentResources,
  recordRecentResource,
} from "./recent-resources.server"

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
    expect(new URL(requests[0]!.url).searchParams.get("limit")).toBe("10")

    await recordRecentResource("dataset-1")
    expect(new URL(requests[1]!.url).pathname).toBe("/account/recent-resources")
    await expect(requests[1]!.json()).resolves.toEqual({
      resource_mfid: "dataset-1",
    })
  })
})
